const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const verifyToken = require("../middleware/authMiddleware");

router.get("/daily", verifyToken, async (req, res) => {
  try {
    const individualRes = await pool.query(`
      SELECT u.id, u.name, u.email,
        COALESCE((SELECT SUM(calculated_co2) FROM transport_activities WHERE user_id=u.id AND DATE(created_at)=CURRENT_DATE),0) +
        COALESCE((SELECT SUM(calculated_co2) FROM energy_activities WHERE user_id=u.id AND DATE(created_at)=CURRENT_DATE),0) +
        COALESCE((SELECT SUM(calculated_co2) FROM food_activities WHERE user_id=u.id AND DATE(created_at)=CURRENT_DATE),0)
        AS daily_co2,
        COALESCE((SELECT total_points FROM user_points WHERE user_id=u.id), 0) AS points,
        COALESCE((SELECT badge FROM user_points WHERE user_id=u.id), 'Eco Starter') AS badge,
        COALESCE((SELECT stars FROM leaderboard_stars WHERE user_id=u.id), 0) AS stars
      FROM users u
      WHERE u.role = 'individual'
      ORDER BY daily_co2 ASC
      LIMIT 10
    `);

    const orgEmpRes = await pool.query(`
      SELECT u.id, u.name, u.email,
        o.name AS org_name, d.name AS dept_name,
        COALESCE((SELECT SUM(calculated_co2) FROM transport_activities WHERE user_id=u.id AND DATE(created_at)=CURRENT_DATE),0) +
        COALESCE((SELECT SUM(calculated_co2) FROM energy_activities WHERE user_id=u.id AND DATE(created_at)=CURRENT_DATE),0) +
        COALESCE((SELECT SUM(calculated_co2) FROM food_activities WHERE user_id=u.id AND DATE(created_at)=CURRENT_DATE),0)
        AS daily_co2,
        COALESCE((SELECT total_points FROM user_points WHERE user_id=u.id), 0) AS points,
        COALESCE((SELECT badge FROM user_points WHERE user_id=u.id), 'Eco Starter') AS badge,
        COALESCE((SELECT stars FROM leaderboard_stars WHERE user_id=u.id), 0) AS stars
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.role = 'org_employee'
      ORDER BY daily_co2 ASC
      LIMIT 10
    `);

    res.json({
      individual: individualRes.rows,
      org_employee: orgEmpRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/award-stars", verifyToken, async (req, res) => {
  try {
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    const alreadyRan = await pool.query(`
      SELECT 1 FROM leaderboard_stars_log WHERE month=$1 AND year=$2
    `, [month, year]);

    if (alreadyRan.rows.length > 0) {
      return res.json({ message: "Stars already awarded this month." });
    }

    const topIndividual = await pool.query(`
      SELECT u.id,
        COALESCE((SELECT SUM(calculated_co2) FROM transport_activities WHERE user_id=u.id AND DATE_TRUNC('month', created_at)=DATE_TRUNC('month', CURRENT_DATE)),0) +
        COALESCE((SELECT SUM(calculated_co2) FROM energy_activities WHERE user_id=u.id AND DATE_TRUNC('month', created_at)=DATE_TRUNC('month', CURRENT_DATE)),0) +
        COALESCE((SELECT SUM(calculated_co2) FROM food_activities WHERE user_id=u.id AND DATE_TRUNC('month', created_at)=DATE_TRUNC('month', CURRENT_DATE)),0)
        AS monthly_co2
      FROM users u
      WHERE u.role = 'individual'
      ORDER BY monthly_co2 ASC
      LIMIT 2
    `);

    const topOrgEmp = await pool.query(`
      SELECT u.id,
        COALESCE((SELECT SUM(calculated_co2) FROM transport_activities WHERE user_id=u.id AND DATE_TRUNC('month', created_at)=DATE_TRUNC('month', CURRENT_DATE)),0) +
        COALESCE((SELECT SUM(calculated_co2) FROM energy_activities WHERE user_id=u.id AND DATE_TRUNC('month', created_at)=DATE_TRUNC('month', CURRENT_DATE)),0) +
        COALESCE((SELECT SUM(calculated_co2) FROM food_activities WHERE user_id=u.id AND DATE_TRUNC('month', created_at)=DATE_TRUNC('month', CURRENT_DATE)),0)
        AS monthly_co2
      FROM users u
      WHERE u.role = 'org_employee'
      ORDER BY monthly_co2 ASC
      LIMIT 2
    `);

    const winners = [...topIndividual.rows, ...topOrgEmp.rows];

    for (const w of winners) {
      await pool.query(`
        INSERT INTO leaderboard_stars (user_id, stars)
        VALUES ($1, 1)
        ON CONFLICT (user_id) DO UPDATE SET stars = leaderboard_stars.stars + 1
      `, [w.id]);
    }

    await pool.query(`
      INSERT INTO leaderboard_stars_log (month, year) VALUES ($1, $2)
    `, [month, year]);

    res.json({ message: `Stars awarded to ${winners.length} users!`, winners });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;