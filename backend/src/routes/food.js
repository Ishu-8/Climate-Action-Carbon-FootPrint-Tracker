const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const verifyToken = require("../middleware/authMiddleware");

router.post("/add", verifyToken, async (req, res) => {
  try {

    const user_id = req.user.id;
    const organization_id = req.user.organization_id;

    const {
      food_factor_id,
      quantity,
      meal_source, 
      cooking_method, 
      is_organic
    } = req.body;

    if (!food_factor_id || !quantity) {
      return res.status(400).json({
        error: "food_factor_id and quantity are required"
      });
    }

    const factorResult = await pool.query(
      "SELECT emission_factor FROM food_emission_factors WHERE id = $1",
      [food_factor_id]
    );

    if (factorResult.rows.length === 0) {
      return res.status(400).json({ error: "Invalid food factor ID" });
    }

    const emissionFactor = factorResult.rows[0].emission_factor;

    let finalCO2 = quantity * emissionFactor;

    // Meal Source multiplier
let mealSourceMultiplier = 1;
if (meal_source) {
  const mealRes = await pool.query(
    `SELECT multiplier FROM adjustment_factors WHERE category='meal_source' AND factor_name=$1`,
    [meal_source]
  );
  mealSourceMultiplier = mealRes.rows[0]?.multiplier || 1;
}

// Cooking Method multiplier
let cookingMultiplier = 1;
if (cooking_method) {
  const cookRes = await pool.query(
    `SELECT multiplier FROM adjustment_factors WHERE category='cooking_method' AND factor_name=$1`,
    [cooking_method]
  );
  cookingMultiplier = cookRes.rows[0]?.multiplier || 1;
}

// Organic multiplier
let organicMultiplier = 1;
if (is_organic !== undefined) {
  const orgRes = await pool.query(
    `SELECT multiplier FROM adjustment_factors WHERE category='organic' AND factor_name=$1`,
    [is_organic ? 'organic' : 'non_organic']
  );
  organicMultiplier = orgRes.rows[0]?.multiplier || 1;
}

const adjustmentFactor = mealSourceMultiplier * cookingMultiplier * organicMultiplier;
finalCO2 = quantity * emissionFactor * adjustmentFactor;

    // Policy impact — food policies check
if (organization_id) {
  try {
    const policyRes = await pool.query(`
      SELECT p.policy_name, p.impact_factor
      FROM policy_assignments pa
      JOIN policies p ON pa.policy_id = p.id
      WHERE pa.user_id = $1
      AND p.enabled = TRUE
AND p.policy_name = 'Veg Cafeteria'
    `, [user_id]);

    for (const policy of policyRes.rows) {
      const reduction = parseFloat(policy.impact_factor);
      finalCO2 = finalCO2 * (1 - reduction);
      console.log(`✅ Food policy: ${policy.policy_name} → -${(reduction*100).toFixed(0)}% CO₂`);
    }
  } catch (policyErr) {
    console.error("Policy error:", policyErr.message);
  }
}

    await pool.query(
      `INSERT INTO food_activities
(user_id, organization_id, food_factor_id,
 quantity, meal_source, cooking_method, is_organic,
 base_factor, adjustment_factor, calculated_co2)
 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
[user_id, organization_id, food_factor_id, quantity,
 meal_source || null, cooking_method || null, is_organic || false,
 emissionFactor, adjustmentFactor, finalCO2]
    );
    const { sendCO2Alert } = require("../utils/mailer");

// After insert — daily total check பண்ணி alert அனுப்பு
try {
  const { sendCO2Alert, sendAdminCO2Alert } = require("../utils/mailer");
  const limit = parseFloat(process.env.CO2_DAILY_LIMIT) || 8;

  const totalRes = await pool.query(`
    SELECT 
      COALESCE((SELECT SUM(calculated_co2) FROM transport_activities WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE), 0) +
      COALESCE((SELECT SUM(calculated_co2) FROM energy_activities WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE), 0) +
      COALESCE((SELECT SUM(calculated_co2) FROM food_activities WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE), 0) AS total
  `, [user_id]);

  const total = parseFloat(totalRes.rows[0].total);

  if (total > limit) {
    const userRes = await pool.query(
      `SELECT u.name, u.email, u.role, u.organization_id, o.name AS org_name 
       FROM users u 
       LEFT JOIN organizations o ON u.organization_id = o.id 
       WHERE u.id = $1`,
      [user_id]
    );
    const dbUser = userRes.rows[0];

    // Already alerted today?
    const alertRes = await pool.query(
      `SELECT id FROM co2_alerts 
       WHERE user_id = $1 AND recipient_id = $1 
       AND DATE(sent_at) = CURRENT_DATE`,
      [user_id]
    );

    if (alertRes.rows.length === 0) {
      const userMsg = `⚠️ Your CO₂ today is ${total.toFixed(2)} kg — exceeded ${limit} kg limit!`;

      // ── 1. User-க்கு email + dashboard alert ──
      await sendCO2Alert({
        toEmail: dbUser.email,
        userName: dbUser.name,
        totalCO2: total,
        limit,
      });

      await pool.query(
        `INSERT INTO co2_alerts (user_id, recipient_id, total_co2, message, is_read, alert_type, sent_at) 
         VALUES ($1, $1, $2, $3, false, 'co2_exceeded', NOW())`,
        [user_id, total, userMsg]
      );

      // ── 2. Org Employee ஆனா → Org Admin + System Admin ──
      if (dbUser.role === "org_employee" && dbUser.organization_id) {

        const orgAdmins = await pool.query(
          `SELECT id, name, email FROM users 
           WHERE role = 'org_admin' AND organization_id = $1`,
          [dbUser.organization_id]
        );

        const sysAdmins = await pool.query(
          `SELECT id, name, email FROM users WHERE role = 'system_admin'`
        );

        const adminMsg = `⚠️ ${dbUser.name} (${dbUser.org_name || "Org"}) CO₂: ${total.toFixed(2)} kg — exceeded ${limit} kg limit!`;

        // Org Admins
        for (const admin of orgAdmins.rows) {
          await sendAdminCO2Alert({
            toEmail: admin.email,
            adminName: admin.name,
            employeeName: dbUser.name,
            employeeEmail: dbUser.email,
            totalCO2: total,
            limit,
            orgName: dbUser.org_name,
          });

          await pool.query(
            `INSERT INTO co2_alerts (user_id, recipient_id, total_co2, message, is_read, alert_type, sent_at)
             VALUES ($1, $2, $3, $4, false, 'employee_exceeded', NOW())`,
            [user_id, admin.id, total, adminMsg]
          );
        }

        // System Admins
        for (const sysAdmin of sysAdmins.rows) {
          await sendAdminCO2Alert({
            toEmail: sysAdmin.email,
            adminName: sysAdmin.name,
            employeeName: dbUser.name,
            employeeEmail: dbUser.email,
            totalCO2: total,
            limit,
            orgName: dbUser.org_name,
          });

          await pool.query(
            `INSERT INTO co2_alerts (user_id, recipient_id, total_co2, message, is_read, alert_type, sent_at)
             VALUES ($1, $2, $3, $4, false, 'employee_exceeded', NOW())`,
            [user_id, sysAdmin.id, total, adminMsg]
          );
        }
      } else if (dbUser.role === "individual") {

  const sysAdmins = await pool.query(
    `SELECT id, name, email FROM users WHERE role = 'system_admin'`
  );

  const adminMsg = `⚠️ Individual user ${dbUser.name} CO₂: ${total.toFixed(2)} kg — exceeded ${limit} kg limit!`;

  for (const sysAdmin of sysAdmins.rows) {
    await sendAdminCO2Alert({
      toEmail: sysAdmin.email,
      adminName: sysAdmin.name,
      employeeName: dbUser.name,
      employeeEmail: dbUser.email,
      totalCO2: total,
      limit,
      orgName: "Individual User",
    });
    await pool.query(
      `INSERT INTO co2_alerts (user_id, recipient_id, total_co2, message, is_read, alert_type, sent_at)
       VALUES ($1, $2, $3, $4, false, 'individual_exceeded', NOW())`,
      [user_id, sysAdmin.id, total, adminMsg]
    );
  }
}
    }
  }
} catch (alertErr) {
  console.error("Alert error (non-critical):", alertErr.message);
}

    // Auto challenge check after activity log
    try {
      const { checkChallenges } = require("../jobs/challengeMonitor");
      checkChallenges();
    } catch (e) {
      console.error("Challenge check error:", e.message);
    }

    res.json({
      message: "Food CO2 calculated successfully",
      co2: finalCO2
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
});
router.get("/", verifyToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await pool.query(
      "SELECT * FROM food_activities WHERE user_id = $1 ORDER BY id DESC",
      [user_id]
    );

    res.json({
      records: result.rows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;