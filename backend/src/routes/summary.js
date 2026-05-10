const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const verifyToken = require("../middleware/authMiddleware");

// Helper function to build date filter
const getDateFilter = (period) => {
  if (period === "daily") {
    return "DATE(created_at) = CURRENT_DATE";
  }
  if (period === "monthly") {
    return `
      EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
    `;
  }
  if (period === "yearly") {
    return `
      EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
    `;
  }
  return "1=1"; // default (all time)
};



// 👤 USER SUMMARY
router.get("/user/:id", verifyToken, async (req, res) => {
  try {

    const requestedUserId = parseInt(req.params.id);
    const loggedUser = req.user;

    // 🔒 SYSTEM ADMIN → allow everything
    if (loggedUser.role === "system_admin") {
      // allow
    }

    // 🔒 INDIVIDUAL → only own summary
    else if (loggedUser.role === "individual") {
      if (loggedUser.id !== requestedUserId) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    // 🔒 ALL OTHER ROLES → blocked
   // ✅ 
else if (loggedUser.role === "org_employee" || loggedUser.role === "org_admin") {
  // access only a Own summary 
  if (loggedUser.id !== requestedUserId) {
    return res.status(403).json({ message: "Access denied" });
  }
}

    const userId = requestedUserId;

    const period = req.query.period || "all";

    // ✅ Period validation
    const allowedPeriods = ["daily", "monthly", "yearly", "all"];
    if (!allowedPeriods.includes(period)) {
      return res.status(400).json({ message: "Invalid period value" });
    }

    const dateFilter = getDateFilter(period);

    const transportQuery = `
      SELECT COALESCE(SUM(calculated_co2),0) AS total
      FROM transport_activities
      WHERE user_id = $1 AND ${dateFilter}
    `;

    const energyQuery = `
      SELECT COALESCE(SUM(calculated_co2),0) AS total
      FROM energy_activities
      WHERE user_id = $1 AND ${dateFilter}
    `;

    const foodQuery = `
      SELECT COALESCE(SUM(calculated_co2),0) AS total
      FROM food_activities
      WHERE user_id = $1 AND ${dateFilter}
    `;

    const transportResult = await pool.query(transportQuery, [userId]);
    const energyResult = await pool.query(energyQuery, [userId]);
    const foodResult = await pool.query(foodQuery, [userId]);

    const transportTotal = parseFloat(transportResult.rows[0].total);
    const energyTotal = parseFloat(energyResult.rows[0].total);
    const foodTotal = parseFloat(foodResult.rows[0].total);

    const grandTotal = transportTotal + energyTotal + foodTotal;

    // Avoid division by zero
    const safeTotal = grandTotal === 0 ? 1 : grandTotal;

    const categories = [
      {
        name: "Transport",
        total: transportTotal,
        percentage: parseFloat(((transportTotal / safeTotal) * 100).toFixed(2))
      },
      {
        name: "Energy",
        total: energyTotal,
        percentage: parseFloat(((energyTotal / safeTotal) * 100).toFixed(2))
      },
      {
        name: "Food",
        total: foodTotal,
        percentage: parseFloat(((foodTotal / safeTotal) * 100).toFixed(2))
      }
    ];

    // Low CO₂ achievement check — daily < 2kg
const totalCO2 = parseFloat(grandTotal || 0);
if (totalCO2 > 0 && totalCO2 < 2.0) {
  try {
    const { sendLowCO2AchievementEmail } = require("../utils/mailer");
    const pool2 = require("../config/db");

    // Points add
    const pointsToAdd = 100;
    const newPoints = await pool2.query(`
      INSERT INTO user_points (user_id, total_points, badge, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET total_points = user_points.total_points + $2,
          badge = CASE WHEN user_points.total_points + $2 >= 1000 THEN '🏆 Eco Champion'
                       WHEN user_points.total_points + $2 >= 500 THEN '🌟 Green Star'
                       ELSE '🌱 Eco Starter' END,
          updated_at = NOW()
      RETURNING total_points, badge
    `, [userId, pointsToAdd, '🌱 Eco Starter']);

    await pool2.query(
      `INSERT INTO points_history (user_id, points, reason) VALUES ($1, $2, $3)`,
      [userId, pointsToAdd, 'Low CO₂ day achievement']
    );

    const userRes = await pool2.query("SELECT name, email FROM users WHERE id = $1", [userId]);
    if (userRes.rows.length > 0) {
      await sendLowCO2AchievementEmail(
        userRes.rows[0].email,
        userRes.rows[0].name,
        totalCO2.toFixed(2),
        pointsToAdd,
        newPoints.rows[0]?.badge
      );
    }
  } catch (e) {
    console.error("Low CO₂ email error:", e.message);
  }
}

    res.json({
      period,
      grand_total: grandTotal,
      categories
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});



// 🏢 ORGANIZATION SUMMARY
router.get("/org/:id", verifyToken, async (req, res) => {
  try {

    const requestedOrgId = parseInt(req.params.id);
    const loggedUser = req.user;


    // 🔒 Individual cannot access organization summary
    if (loggedUser.role === "individual") {
      return res.status(403).json({ message: "Access denied" });
    }

    // 🔒 Org employee/admin can only access their own organization
    if (
      (loggedUser.role === "org_employee" || loggedUser.role === "org_admin") &&
      loggedUser.organization_id !== requestedOrgId
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    // ✅ system_admin allowed everything (no restriction)

    const orgId = requestedOrgId;

    const period = req.query.period || "all";

    // ✅ Period validation
    const allowedPeriods = ["daily", "monthly", "yearly", "all"];
    if (!allowedPeriods.includes(period)) {
      return res.status(400).json({ message: "Invalid period value" });
    }

    const dateFilter = getDateFilter(period);

    const transportQuery = `
      SELECT COALESCE(SUM(calculated_co2),0) AS total
      FROM transport_activities
      WHERE organization_id = $1 AND ${dateFilter}
    `;

    const energyQuery = `
      SELECT COALESCE(SUM(calculated_co2),0) AS total
      FROM energy_activities
      WHERE organization_id = $1 AND ${dateFilter}
    `;

    const foodQuery = `
      SELECT COALESCE(SUM(calculated_co2),0) AS total
      FROM food_activities
      WHERE organization_id = $1 AND ${dateFilter}
    `;

    const transportResult = await pool.query(transportQuery, [orgId]);
    const energyResult = await pool.query(energyQuery, [orgId]);
    const foodResult = await pool.query(foodQuery, [orgId]);

    const empCount = await pool.query(
  "SELECT COUNT(*) FROM users WHERE organization_id = $1 AND role != 'system_admin'",
  [orgId]
);
  
    const transportTotal = parseFloat(transportResult.rows[0].total);
    const energyTotal = parseFloat(energyResult.rows[0].total);
    const foodTotal = parseFloat(foodResult.rows[0].total);

    const grandTotal = transportTotal + energyTotal + foodTotal;

    // Avoid division by zero
    const safeTotal = grandTotal === 0 ? 1 : grandTotal;

    const categories = [
      {
        name: "Transport",
        total: transportTotal,
        percentage: parseFloat(((transportTotal / safeTotal) * 100).toFixed(2))
      },
      {
        name: "Energy",
        total: energyTotal,
        percentage: parseFloat(((energyTotal / safeTotal) * 100).toFixed(2))
      },
      {
        name: "Food",
        total: foodTotal,
        percentage: parseFloat(((foodTotal / safeTotal) * 100).toFixed(2))
      }
    ];

    res.json({
      period,
      grand_total: grandTotal,
      categories,
      employee_count: parseInt(empCount.rows[0].count) 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;