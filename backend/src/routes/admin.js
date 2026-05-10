const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const verifyToken = require("../middleware/authMiddleware");

// ── System Admin மட்டும் access பண்ண முடியும் ──
const isSystemAdmin = (req, res, next) => {
  if (req.user.role !== "system_admin") {
    return res.status(403).json({ message: "System Admin only" });
  }
  next();
};

// ══════════════════════════════════════════
// GET /api/admin/stats - System Overview
// ══════════════════════════════════════════
router.get("/stats", verifyToken, isSystemAdmin, async (req, res) => {
  try {
    // Total users
    const usersResult = await pool.query(
      "SELECT COUNT(*) FROM users WHERE role != 'system_admin'"
    );

    // Total organizations
    const orgsResult = await pool.query(
      "SELECT COUNT(*) FROM organizations"
    );

    // Total CO₂ today
    const co2Result = await pool.query(`
      SELECT 
        COALESCE(
          (SELECT SUM(calculated_co2) FROM transport_activities 
           WHERE DATE(created_at) = CURRENT_DATE), 0
        ) +
        COALESCE(
          (SELECT SUM(calculated_co2) FROM energy_activities 
           WHERE DATE(created_at) = CURRENT_DATE), 0
        ) +
        COALESCE(
          (SELECT SUM(calculated_co2) FROM food_activities 
           WHERE DATE(created_at) = CURRENT_DATE), 0
        ) AS total_co2
    `);

    res.json({
      total_users: parseInt(usersResult.rows[0].count),
      total_orgs: parseInt(orgsResult.rows[0].count),
      total_co2_today: parseFloat(co2Result.rows[0].total_co2),
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════
// GET /api/admin/users - All Users List
// ══════════════════════════════════════════
router.get("/users", verifyToken, isSystemAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.created_at,
        o.name AS organization,
        d.name AS department,
        COALESCE(
          (SELECT SUM(calculated_co2) FROM transport_activities 
           WHERE user_id = u.id AND DATE(created_at) = CURRENT_DATE), 0
        ) +
        COALESCE(
          (SELECT SUM(calculated_co2) FROM energy_activities 
           WHERE user_id = u.id AND DATE(created_at) = CURRENT_DATE), 0
        ) +
        COALESCE(
          (SELECT SUM(calculated_co2) FROM food_activities 
           WHERE user_id = u.id AND DATE(created_at) = CURRENT_DATE), 0
        ) AS today_co2
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.role != 'system_admin'
      ORDER BY u.created_at DESC
    `);

    res.json({ users: result.rows });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════
// DELETE /api/admin/users/:id - Remove User
// ══════════════════════════════════════════
router.delete("/users/:id", verifyToken, isSystemAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // User activities delete பண்ணு முதல்ல
    await pool.query(
      "DELETE FROM transport_activities WHERE user_id = $1", [id]
    );
    await pool.query(
      "DELETE FROM energy_activities WHERE user_id = $1", [id]
    );
    await pool.query(
      "DELETE FROM food_activities WHERE user_id = $1", [id]
    );

    // User delete பண்ணு
    await pool.query("DELETE FROM users WHERE id = $1", [id]);

    res.json({ message: "User removed successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════
// GET /api/admin/organizations - All Orgs
// ══════════════════════════════════════════
router.get("/organizations", verifyToken, isSystemAdmin, async (req, res) => {
  try {
   const result = await pool.query(`
  SELECT 
    o.id,
    o.name,
    o.created_at,
    COUNT(DISTINCT u.id) AS total_employees,
    COUNT(DISTINCT d.id) AS total_departments,
    (SELECT name FROM users WHERE organization_id = o.id AND role = 'org_admin' LIMIT 1) AS org_admin_name,
    COALESCE(
      (SELECT SUM(calculated_co2) FROM transport_activities ta
       JOIN users u2 ON ta.user_id = u2.id
       WHERE u2.organization_id = o.id 
       AND DATE(ta.created_at) = CURRENT_DATE), 0
    ) +
    COALESCE(
      (SELECT SUM(calculated_co2) FROM energy_activities ea
       JOIN users u3 ON ea.user_id = u3.id
       WHERE u3.organization_id = o.id 
       AND DATE(ea.created_at) = CURRENT_DATE), 0
    ) AS today_co2
  FROM organizations o
  LEFT JOIN users u ON u.organization_id = o.id 
    AND u.role = 'org_employee'
  LEFT JOIN departments d ON d.organization_id = o.id
  GROUP BY o.id, o.name, o.created_at
  ORDER BY o.created_at DESC
`);

    res.json({ organizations: result.rows });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
// ══════════════════════════════════════════
// GET /api/admin/charts - CO₂ Chart Data
// ══════════════════════════════════════════
// ══════════════════════════════════════════
// GET /api/admin/charts - CO₂ Chart Data
// ══════════════════════════════════════════
router.get("/charts", verifyToken, isSystemAdmin, async (req, res) => {
  const period = req.query.period || "daily";

  try {
    let trendQuery;

    if (period === "daily") {
      trendQuery = `
        SELECT TO_CHAR(date_series, 'Mon DD') AS label,
               date_series::date AS date_val
        FROM generate_series(
          CURRENT_DATE - INTERVAL '6 days',
          CURRENT_DATE,
          '1 day'::interval
        ) AS date_series
      `;
    } else if (period === "monthly") {
      trendQuery = `
        SELECT TO_CHAR(date_series, 'Mon YYYY') AS label,
               DATE_TRUNC('month', date_series)::date AS date_val
        FROM generate_series(
          DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months'),
          DATE_TRUNC('month', CURRENT_DATE),
          '1 month'::interval
        ) AS date_series
      `;
    } else {
      trendQuery = `
        SELECT TO_CHAR(date_series, 'YYYY') AS label,
               DATE_TRUNC('year', date_series)::date AS date_val
        FROM generate_series(
          DATE_TRUNC('year', CURRENT_DATE - INTERVAL '2 years'),
          DATE_TRUNC('year', CURRENT_DATE),
          '1 year'::interval
        ) AS date_series
      `;
    }

    const dateRange = await pool.query(trendQuery);

    // ── Trend ──
    const trend = await Promise.all(dateRange.rows.map(async (row) => {
      const dateVal = new Date(row.date_val).toISOString().split('T')[0];

      let dateFilter;
      if (period === "daily") {
        dateFilter = `DATE(created_at) = '${dateVal}'`;
      } else if (period === "monthly") {
        dateFilter = `DATE_TRUNC('month', created_at) = DATE_TRUNC('month', '${dateVal}'::date)`;
      } else {
        dateFilter = `DATE_TRUNC('year', created_at) = DATE_TRUNC('year', '${dateVal}'::date)`;
      }

      const [t, e, f] = await Promise.all([
        pool.query(`SELECT COALESCE(SUM(calculated_co2),0) AS total FROM transport_activities WHERE ${dateFilter}`),
        pool.query(`SELECT COALESCE(SUM(calculated_co2),0) AS total FROM energy_activities WHERE ${dateFilter}`),
        pool.query(`SELECT COALESCE(SUM(calculated_co2),0) AS total FROM food_activities WHERE ${dateFilter}`),
      ]);

      return {
        label: row.label,
        transport_co2: parseFloat(t.rows[0].total),
        energy_co2: parseFloat(e.rows[0].total),
        food_co2: parseFloat(f.rows[0].total),
        total_co2: parseFloat(t.rows[0].total) + parseFloat(e.rows[0].total) + parseFloat(f.rows[0].total),
      };
    }));

    // ── Individual vs Org ──
    const indVsOrg = await Promise.all(dateRange.rows.map(async (row) => {
      const dateVal = new Date(row.date_val).toISOString().split('T')[0];

      const indQuery = `
        SELECT 
          COALESCE((SELECT SUM(t.calculated_co2) FROM transport_activities t JOIN users u ON t.user_id = u.id WHERE u.role = 'individual' AND DATE(t.created_at) = '${dateVal}'), 0) +
          COALESCE((SELECT SUM(e.calculated_co2) FROM energy_activities e JOIN users u ON e.user_id = u.id WHERE u.role = 'individual' AND DATE(e.created_at) = '${dateVal}'), 0) +
          COALESCE((SELECT SUM(f.calculated_co2) FROM food_activities f JOIN users u ON f.user_id = u.id WHERE u.role = 'individual' AND DATE(f.created_at) = '${dateVal}'), 0) AS total
      `;

      const orgQuery = `
        SELECT 
          COALESCE((SELECT SUM(t.calculated_co2) FROM transport_activities t JOIN users u ON t.user_id = u.id WHERE u.role IN ('org_employee','org_admin') AND DATE(t.created_at) = '${dateVal}'), 0) +
          COALESCE((SELECT SUM(e.calculated_co2) FROM energy_activities e JOIN users u ON e.user_id = u.id WHERE u.role IN ('org_employee','org_admin') AND DATE(e.created_at) = '${dateVal}'), 0) +
          COALESCE((SELECT SUM(f.calculated_co2) FROM food_activities f JOIN users u ON f.user_id = u.id WHERE u.role IN ('org_employee','org_admin') AND DATE(f.created_at) = '${dateVal}'), 0) AS total
      `;

      const [ind, org] = await Promise.all([
        pool.query(indQuery),
        pool.query(orgQuery),
      ]);

      return {
        label: row.label,
        individual_co2: parseFloat(ind.rows[0].total),
        org_co2: parseFloat(org.rows[0].total),
      };
    }));

    // ── Category summary ──
    const [totalT, totalE, totalF] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(calculated_co2),0) AS total FROM transport_activities`),
      pool.query(`SELECT COALESCE(SUM(calculated_co2),0) AS total FROM energy_activities`),
      pool.query(`SELECT COALESCE(SUM(calculated_co2),0) AS total FROM food_activities`),
    ]);

    const tTotal = parseFloat(totalT.rows[0].total);
    const eTotal = parseFloat(totalE.rows[0].total);
    const fTotal = parseFloat(totalF.rows[0].total);
    const grandTotal = tTotal + eTotal + fTotal || 1;

    const categories = [
      { name: "Transport", total: tTotal, percentage: +((tTotal / grandTotal) * 100).toFixed(1) },
      { name: "Energy", total: eTotal, percentage: +((eTotal / grandTotal) * 100).toFixed(1) },
      { name: "Food", total: fTotal, percentage: +((fTotal / grandTotal) * 100).toFixed(1) },
    ];

    res.json({ trend, categories, ind_vs_org: indVsOrg });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;