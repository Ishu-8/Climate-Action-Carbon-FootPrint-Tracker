const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const verifyToken = require("../middleware/authMiddleware");

router.get("/data", verifyToken, async (req, res) => {
  const user_id = req.user.id;
  const role = req.user.role;
  const { period } = req.query;

  let dateFilter, prevDateFilter, periodLabel;
  if (period === "weekly") {
    dateFilter = `created_at >= CURRENT_DATE - INTERVAL '7 days'`;
    prevDateFilter = `created_at >= CURRENT_DATE - INTERVAL '14 days' AND created_at < CURRENT_DATE - INTERVAL '7 days'`;
    periodLabel = "This Week";
  } else {
    dateFilter = `DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`;
    prevDateFilter = `DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`;
    periodLabel = "This Month";
  }

  // Table-prefixed versions for JOIN queries
  const taFilter = dateFilter.replace(/created_at/g, "ta.created_at");
  const eaFilter = dateFilter.replace(/created_at/g, "ea.created_at");
  const faFilter = dateFilter.replace(/created_at/g, "fa.created_at");

  try {
    const userRes = await pool.query(`
      SELECT u.name, u.email, u.role, o.name AS org_name, d.name AS dept_name
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = $1
    `, [user_id]);
    const userInfo = userRes.rows[0];

    // ══════════════════════════════════
    //  SYSTEM ADMIN
    // ══════════════════════════════════
    if (role === "system_admin") {
      const sysT = await pool.query(`SELECT COALESCE(SUM(calculated_co2),0) AS total FROM transport_activities WHERE ${dateFilter}`);
      const sysE = await pool.query(`SELECT COALESCE(SUM(calculated_co2),0) AS total FROM energy_activities WHERE ${dateFilter}`);
      const sysF = await pool.query(`SELECT COALESCE(SUM(calculated_co2),0) AS total FROM food_activities WHERE ${dateFilter}`);

      const orgBreakdown = await pool.query(`
        SELECT o.name AS org_name,
          COALESCE((SELECT SUM(ta.calculated_co2) FROM transport_activities ta JOIN users u2 ON ta.user_id=u2.id WHERE u2.organization_id=o.id AND ${taFilter}),0) +
          COALESCE((SELECT SUM(ea.calculated_co2) FROM energy_activities ea JOIN users u2 ON ea.user_id=u2.id WHERE u2.organization_id=o.id AND ${eaFilter}),0) +
          COALESCE((SELECT SUM(fa.calculated_co2) FROM food_activities fa JOIN users u2 ON fa.user_id=u2.id WHERE u2.organization_id=o.id AND ${faFilter}),0) AS total_co2,
          COUNT(DISTINCT u.id) AS employee_count
        FROM organizations o
        LEFT JOIN users u ON u.organization_id = o.id AND u.role = 'org_employee'
        GROUP BY o.id, o.name
        ORDER BY total_co2 DESC
      `);

      const indBreakdown = await pool.query(`
        SELECT u.name, u.email,
          COALESCE((SELECT SUM(calculated_co2) FROM transport_activities WHERE user_id=u.id AND ${dateFilter}),0) +
          COALESCE((SELECT SUM(calculated_co2) FROM energy_activities WHERE user_id=u.id AND ${dateFilter}),0) +
          COALESCE((SELECT SUM(calculated_co2) FROM food_activities WHERE user_id=u.id AND ${dateFilter}),0) AS total_co2
        FROM users u WHERE u.role = 'individual'
        ORDER BY total_co2 DESC
      `);

      const days = period === "weekly" ? 7 : 30;
      const trend = await pool.query(`
        SELECT date_series::date AS date,
          COALESCE((SELECT SUM(calculated_co2) FROM transport_activities WHERE DATE(created_at)=date_series::date),0) +
          COALESCE((SELECT SUM(calculated_co2) FROM energy_activities WHERE DATE(created_at)=date_series::date),0) +
          COALESCE((SELECT SUM(calculated_co2) FROM food_activities WHERE DATE(created_at)=date_series::date),0) AS total
        FROM generate_series(CURRENT_DATE - INTERVAL '${days-1} days', CURRENT_DATE, '1 day') AS date_series
      `);

      return res.json({
        role: "system_admin",
        user: userInfo,
        period: periodLabel,
        system_total: {
          transport: parseFloat(sysT.rows[0].total),
          energy: parseFloat(sysE.rows[0].total),
          food: parseFloat(sysF.rows[0].total),
          total: parseFloat(sysT.rows[0].total) + parseFloat(sysE.rows[0].total) + parseFloat(sysF.rows[0].total)
        },
        org_breakdown: orgBreakdown.rows,
        individual_breakdown: indBreakdown.rows,
        trend: trend.rows,
      });
    }

    // ══════════════════════════════════
    //  ORG ADMIN
    // ══════════════════════════════════
    if (role === "org_admin") {
      const orgRes = await pool.query(`SELECT organization_id FROM users WHERE id=$1`, [user_id]);
      const org_id = orgRes.rows[0]?.organization_id;

      const orgT = await pool.query(`
        SELECT COALESCE(SUM(ta.calculated_co2),0) AS total 
        FROM transport_activities ta 
        JOIN users u ON ta.user_id=u.id 
        WHERE u.organization_id=$1 AND ${taFilter}
      `, [org_id]);

      const orgE = await pool.query(`
        SELECT COALESCE(SUM(ea.calculated_co2),0) AS total 
        FROM energy_activities ea 
        JOIN users u ON ea.user_id=u.id 
        WHERE u.organization_id=$1 AND ${eaFilter}
      `, [org_id]);

      const orgF = await pool.query(`
        SELECT COALESCE(SUM(fa.calculated_co2),0) AS total 
        FROM food_activities fa 
        JOIN users u ON fa.user_id=u.id 
        WHERE u.organization_id=$1 AND ${faFilter}
      `, [org_id]);

      const empBreakdown = await pool.query(`
        SELECT u.name, u.email, d.name AS department,
          COALESCE((SELECT SUM(calculated_co2) FROM transport_activities WHERE user_id=u.id AND ${dateFilter}),0) AS transport_co2,
          COALESCE((SELECT SUM(calculated_co2) FROM energy_activities WHERE user_id=u.id AND ${dateFilter}),0) AS energy_co2,
          COALESCE((SELECT SUM(calculated_co2) FROM food_activities WHERE user_id=u.id AND ${dateFilter}),0) AS food_co2,
          COALESCE((SELECT SUM(calculated_co2) FROM transport_activities WHERE user_id=u.id AND ${dateFilter}),0) +
          COALESCE((SELECT SUM(calculated_co2) FROM energy_activities WHERE user_id=u.id AND ${dateFilter}),0) +
          COALESCE((SELECT SUM(calculated_co2) FROM food_activities WHERE user_id=u.id AND ${dateFilter}),0) AS total_co2
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.organization_id=$1 AND u.role='org_employee'
        ORDER BY total_co2 DESC
      `, [org_id]);

      const deptBreakdown = await pool.query(`
        SELECT d.name AS department,
          COUNT(u.id) AS employee_count,
          COALESCE(SUM(
            COALESCE((SELECT SUM(calculated_co2) FROM transport_activities WHERE user_id=u.id AND ${dateFilter}),0) +
            COALESCE((SELECT SUM(calculated_co2) FROM energy_activities WHERE user_id=u.id AND ${dateFilter}),0) +
            COALESCE((SELECT SUM(calculated_co2) FROM food_activities WHERE user_id=u.id AND ${dateFilter}),0)
          ),0) AS total_co2
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.organization_id=$1 AND u.role='org_employee'
        GROUP BY d.name ORDER BY total_co2 DESC
      `, [org_id]);

      const days = period === "weekly" ? 7 : 30;
      const trend = await pool.query(`
        SELECT date_series::date AS date,
          COALESCE((SELECT SUM(ta.calculated_co2) FROM transport_activities ta JOIN users u ON ta.user_id=u.id WHERE u.organization_id=$1 AND ${taFilter}),0) +
          COALESCE((SELECT SUM(ea.calculated_co2) FROM energy_activities ea JOIN users u ON ea.user_id=u.id WHERE u.organization_id=$1 AND ${eaFilter}),0) +
          COALESCE((SELECT SUM(fa.calculated_co2) FROM food_activities fa JOIN users u ON fa.user_id=u.id WHERE u.organization_id=$1 AND ${faFilter}),0) AS total
        FROM generate_series(CURRENT_DATE - INTERVAL '${days-1} days', CURRENT_DATE, '1 day') AS date_series
      `, [org_id]);

      return res.json({
        role: "org_admin",
        user: userInfo,
        period: periodLabel,
        org_total: {
          transport: parseFloat(orgT.rows[0].total),
          energy: parseFloat(orgE.rows[0].total),
          food: parseFloat(orgF.rows[0].total),
          total: parseFloat(orgT.rows[0].total) + parseFloat(orgE.rows[0].total) + parseFloat(orgF.rows[0].total)
        },
        emp_breakdown: empBreakdown.rows,
        dept_breakdown: deptBreakdown.rows,
        trend: trend.rows,
      });
    }

    // ══════════════════════════════════
    //  INDIVIDUAL / ORG EMPLOYEE
    // ══════════════════════════════════
    const [t, e, f] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(calculated_co2),0) AS total FROM transport_activities WHERE user_id=$1 AND ${dateFilter}`, [user_id]),
      pool.query(`SELECT COALESCE(SUM(calculated_co2),0) AS total FROM energy_activities WHERE user_id=$1 AND ${dateFilter}`, [user_id]),
      pool.query(`SELECT COALESCE(SUM(calculated_co2),0) AS total FROM food_activities WHERE user_id=$1 AND ${dateFilter}`, [user_id]),
    ]);
    const [pt, pe, pf] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(calculated_co2),0) AS total FROM transport_activities WHERE user_id=$1 AND ${prevDateFilter}`, [user_id]),
      pool.query(`SELECT COALESCE(SUM(calculated_co2),0) AS total FROM energy_activities WHERE user_id=$1 AND ${prevDateFilter}`, [user_id]),
      pool.query(`SELECT COALESCE(SUM(calculated_co2),0) AS total FROM food_activities WHERE user_id=$1 AND ${prevDateFilter}`, [user_id]),
    ]);

    const days = period === "weekly" ? 7 : 30;
    const trendRes = await pool.query(`
      SELECT date_series::date AS date,
        COALESCE((SELECT SUM(calculated_co2) FROM transport_activities WHERE user_id=$1 AND DATE(created_at)=date_series::date),0) +
        COALESCE((SELECT SUM(calculated_co2) FROM energy_activities WHERE user_id=$1 AND DATE(created_at)=date_series::date),0) +
        COALESCE((SELECT SUM(calculated_co2) FROM food_activities WHERE user_id=$1 AND DATE(created_at)=date_series::date),0) AS total
      FROM generate_series(CURRENT_DATE - INTERVAL '${days-1} days', CURRENT_DATE, '1 day') AS date_series
    `, [user_id]);

    const challengeRes = await pool.query(`
      SELECT challenge_name, challenge_type, points, completed, joined_at, end_date
      FROM challenge_participants WHERE user_id=$1 ORDER BY joined_at DESC
    `, [user_id]);

    const pointsRes = await pool.query(`
      SELECT total_points, badge FROM user_points WHERE user_id=$1
    `, [user_id]);

    res.json({
      role,
      user: userInfo,
      period: periodLabel,
      current: {
        transport: parseFloat(t.rows[0].total),
        energy: parseFloat(e.rows[0].total),
        food: parseFloat(f.rows[0].total),
        total: parseFloat(t.rows[0].total) + parseFloat(e.rows[0].total) + parseFloat(f.rows[0].total)
      },
      previous: {
        transport: parseFloat(pt.rows[0].total),
        energy: parseFloat(pe.rows[0].total),
        food: parseFloat(pf.rows[0].total),
        total: parseFloat(pt.rows[0].total) + parseFloat(pe.rows[0].total) + parseFloat(pf.rows[0].total)
      },
      trend: trendRes.rows,
      challenges: challengeRes.rows,
      points: pointsRes.rows[0] || { total_points: 0, badge: "Eco Starter" },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;