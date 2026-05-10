const verifyToken = require("../middleware/authMiddleware");
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// =============================
// 🚀 POST - Add Transport Entry
// =============================
router.post("/", verifyToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const organization_id = req.user.organization_id;

    // ✅ Safe destructuring
    const {
      transport_factor_id,
      distance_km,
      traffic_level,
      ac_used,
      vehicle_age,
      weather
    } = req.body || {};

    // 🔴 Validate required fields
    if (!transport_factor_id || !distance_km) {
      return res.status(400).json({
        error: "transport_factor_id and distance_km are required"
      });
    }

    // 1️⃣ Get base emission factor
    const factorResult = await pool.query(
      "SELECT emission_factor FROM transport_emission_factors WHERE id = $1",
      [transport_factor_id]
    );

    if (factorResult.rows.length === 0) {
      return res.status(400).json({
        error: "Invalid transport factor ID"
      });
    }

    const emissionFactor = factorResult.rows[0].emission_factor;

    // 2️⃣ Traffic multiplier
    let trafficMultiplier = 1;
    if (traffic_level) {
      const trafficResult = await pool.query(
        `SELECT multiplier 
         FROM adjustment_factors 
         WHERE category = 'traffic' 
         AND factor_name = $1`,
        [traffic_level]
      );

      trafficMultiplier = trafficResult.rows[0]?.multiplier || 1;
    }

    // 3️⃣ AC multiplier
    let acMultiplier = 1;
    if (ac_used) {
      const acResult = await pool.query(
        `SELECT multiplier 
         FROM adjustment_factors 
         WHERE category = 'ac' 
         AND factor_name = 'AC_ON'`
      );

      acMultiplier = acResult.rows[0]?.multiplier || 1;
    }

    // 4️⃣ Vehicle Age multiplier
let vehicleAgeMultiplier = 1;
if (vehicle_age) {
  const vehicleAgeResult = await pool.query(
    `SELECT multiplier FROM adjustment_factors 
     WHERE category = 'vehicle_age' AND factor_name = $1`,
    [vehicle_age]
  );
  vehicleAgeMultiplier = vehicleAgeResult.rows[0]?.multiplier || 1;
}

// 5️⃣ Weather multiplier
let weatherMultiplier = 1;
if (weather) {
  const weatherResult = await pool.query(
    `SELECT multiplier FROM adjustment_factors 
     WHERE category = 'weather' AND factor_name = $1`,
    [weather]
  );
  weatherMultiplier = weatherResult.rows[0]?.multiplier || 1;
}

const adjustmentFactor = trafficMultiplier * acMultiplier * vehicleAgeMultiplier * weatherMultiplier;

let finalCO2 =
  Number(distance_km) *
  Number(emissionFactor) *
  Number(adjustmentFactor);

// Policy impact — transport policies check
if (organization_id) {
  try {
    const policyRes = await pool.query(`
      SELECT p.policy_name, p.impact_factor
      FROM policy_assignments pa
      JOIN policies p ON pa.policy_id = p.id
      WHERE pa.user_id = $1
      AND p.enabled = TRUE
AND (p.policy_name = 'Work From Home' OR p.policy_name = 'Carpooling')
    `, [user_id]);

    for (const policy of policyRes.rows) {
      const reduction = parseFloat(policy.impact_factor);
      finalCO2 = finalCO2 * (1 - reduction);
      console.log(`✅ Transport policy: ${policy.policy_name} → -${(reduction*100).toFixed(0)}% CO₂`);
    }
  } catch (policyErr) {
    console.error("Policy error:", policyErr.message);
  }
}

    // 4️⃣ Insert into DB
    await pool.query(
     `INSERT INTO transport_activities
(user_id, organization_id, transport_factor_id,
 distance_km, traffic_level, ac_used, vehicle_age, weather,
 base_factor, adjustment_factor, calculated_co2)
 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
[
  user_id, organization_id, transport_factor_id,
  distance_km, traffic_level || null, ac_used || false,
  vehicle_age || null, weather || null,
  emissionFactor, adjustmentFactor, finalCO2
]
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
      message: "Transport CO2 calculated successfully",
      co2: finalCO2
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
});


// =============================
// 📄 GET - Get User Transport Records
// =============================
router.get("/", verifyToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await pool.query(
      `SELECT *
       FROM transport_activities
       WHERE user_id = $1
       ORDER BY created_at DESC`,
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