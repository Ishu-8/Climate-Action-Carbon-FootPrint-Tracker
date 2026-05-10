const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const verifyToken = require("../middleware/authMiddleware");

// ══════════════════════════════════════════
// GET /api/org/:orgId/leaderboard
// Department employees - CO₂ ranking
// ══════════════════════════════════════════
router.get("/:orgId/leaderboard", verifyToken, async (req, res) => {
  const { orgId } = req.params;
  const period = req.query.period || "daily";

  let dateFilter;
  if (period === "daily") dateFilter = "DATE(created_at) = CURRENT_DATE";
  else if (period === "monthly") dateFilter = `
    EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`;
  else dateFilter = `
    EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`;

  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        d.name AS department,
        COALESCE((
          SELECT SUM(calculated_co2) FROM transport_activities
          WHERE user_id = u.id AND ${dateFilter}
        ), 0) +
        COALESCE((
          SELECT SUM(calculated_co2) FROM energy_activities
          WHERE user_id = u.id AND ${dateFilter}
        ), 0) +
        COALESCE((
          SELECT SUM(calculated_co2) FROM food_activities
          WHERE user_id = u.id AND ${dateFilter}
        ), 0) AS total_co2
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.organization_id = $1
        AND u.role = 'org_employee'
      ORDER BY total_co2 ASC
    `, [orgId]);

    res.json({ leaderboard: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════
// GET /api/org/:orgId/employees
// ══════════════════════════════════════════
router.get("/:orgId/employees", verifyToken, async (req, res) => {
  const { orgId } = req.params;
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, d.name AS department,
        COALESCE((
          SELECT SUM(calculated_co2) FROM transport_activities
          WHERE user_id = u.id AND DATE(created_at) = CURRENT_DATE
        ), 0) +
        COALESCE((
          SELECT SUM(calculated_co2) FROM energy_activities
          WHERE user_id = u.id AND DATE(created_at) = CURRENT_DATE
        ), 0) +
        COALESCE((
          SELECT SUM(calculated_co2) FROM food_activities
          WHERE user_id = u.id AND DATE(created_at) = CURRENT_DATE
        ), 0) AS total_co2
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.organization_id = $1
        AND u.role = 'org_employee'
      ORDER BY u.name
    `, [orgId]);
    res.json({ employees: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════
// GET /api/org/:orgId/dept-summary
// ══════════════════════════════════════════
router.get("/:orgId/dept-summary", verifyToken, async (req, res) => {
  const { orgId } = req.params;
  try {
    const depts = await pool.query(
      "SELECT id, name FROM departments WHERE organization_id = $1",
      [orgId]
    );

    const result = await Promise.all(depts.rows.map(async (d) => {
      const [t, e, f] = await Promise.all([
        pool.query(`
          SELECT COALESCE(SUM(ta.calculated_co2),0) AS total
          FROM transport_activities ta
          JOIN users u ON ta.user_id = u.id
          WHERE u.department_id = $1`, [d.id]),
        pool.query(`
          SELECT COALESCE(SUM(ea.calculated_co2),0) AS total
          FROM energy_activities ea
          JOIN users u ON ea.user_id = u.id
          WHERE u.department_id = $1`, [d.id]),
        pool.query(`
          SELECT COALESCE(SUM(fa.calculated_co2),0) AS total
          FROM food_activities fa
          JOIN users u ON fa.user_id = u.id
          WHERE u.department_id = $1`, [d.id]),
      ]);

      const transport = parseFloat(t.rows[0].total);
      const energy = parseFloat(e.rows[0].total);
      const food = parseFloat(f.rows[0].total);

      return {
        name: d.name,
        transport_co2: transport,
        energy_co2: energy,
        food_co2: food,
        total_co2: transport + energy + food,
      };
    }));

    res.json({ departments: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ══════════════════════════════════════════
// GET /api/org/:orgId/policies
// ══════════════════════════════════════════
router.get("/:orgId/policies", verifyToken, async (req, res) => {
  const { orgId } = req.params;
  try {
    let result = await pool.query(
      "SELECT * FROM policies WHERE organization_id = $1",
      [orgId]
    );

    // Auto-create policies for this org if none exist
    if (result.rows.length === 0) {
      result = await pool.query(`
        INSERT INTO policies (policy_name, impact_factor, enabled, description, organization_id)
        VALUES 
          ('Work From Home', 0.18, false, 'Reduces transport emissions by 18%', $1),
          ('Carpooling', 0.25, false, 'Reduces transport CO₂ by 25%', $1),
          ('Solar Energy', 0.40, false, 'Reduces energy CO₂ by 40%', $1),
          ('Veg Cafeteria', 0.30, false, 'Reduces food CO₂ by 30%', $1)
        RETURNING *
      `, [orgId]);
    }

    res.json({ policies: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════
// GET /api/org/:orgId/my-history
// Employee-ஓட own activity history
// ══════════════════════════════════════════
router.get("/:orgId/my-history", verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const [t, e, f] = await Promise.all([
      pool.query(`SELECT *, 'transport' AS category FROM transport_activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [userId]),
      pool.query(`SELECT *, 'energy' AS category FROM energy_activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [userId]),
      pool.query(`SELECT *, 'food' AS category FROM food_activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [userId]),
    ]);

    const records = [
      ...t.rows,
      ...e.rows,
      ...f.rows,
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ══════════════════════════════════════════
// PATCH /api/org/policies/:id — Toggle Policy
// Only org_admin can toggle
// ══════════════════════════════════════════
router.patch("/policies/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body;

  if (req.user.role !== "org_admin" && req.user.role !== "system_admin") {
    return res.status(403).json({ message: "Only org admin can change policies" });
  }

  try {
    // update policies table 
    await pool.query(
      "UPDATE policies SET enabled = $1 WHERE id = $2",
      [enabled, id]
    );
    res.json({ message: `Policy ${enabled ? "enabled" : "disabled"} successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ══════════════════════════════════════════
// POST /api/org/policies/:id/assign
// Assign policy to specific employees OR all
// ══════════════════════════════════════════
router.post("/policies/:id/assign", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { user_ids, apply_all, org_id } = req.body;

  if (req.user.role !== "org_admin" && req.user.role !== "system_admin") {
    return res.status(403).json({ message: "Only org admin can assign policies" });
  }

  try {
    // ✅ Policy-ஓட actual org_id fetch பண்ணு — body-ல வர்றதை trust பண்ணாதே
    const policyCheck = await pool.query(
      "SELECT organization_id FROM policies WHERE id = $1",
      [id]
    );
    if (policyCheck.rows.length === 0) {
      return res.status(404).json({ message: "Policy not found" });
    }
    const policyOrgId = policyCheck.rows[0].organization_id;

    if (apply_all) {
      // ✅ policyOrgId use பண்ணு — org_id from body வேண்டாம்
      const employees = await pool.query(
        "SELECT id FROM users WHERE organization_id = $1 AND role = 'org_employee'",
        [policyOrgId]
      );
      for (const emp of employees.rows) {
        await pool.query(
          `INSERT INTO policy_assignments (policy_id, user_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, emp.id]
        );
      }
      res.json({ message: "Policy applied to all employees" });
    } else {
      // ✅ Specific users — only same org employees
      for (const userId of user_ids) {
        const userCheck = await pool.query(
          "SELECT id FROM users WHERE id = $1 AND organization_id = $2",
          [userId, policyOrgId]
        );
        if (userCheck.rows.length > 0) {
          await pool.query(
            `INSERT INTO policy_assignments (policy_id, user_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [id, userId]
          );
        }
      }
      res.json({ message: "Policy applied to selected employees" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ══════════════════════════════════════════
// DELETE /api/org/policies/:id/unassign
// Remove policy from employees
// ══════════════════════════════════════════
router.delete("/policies/:id/unassign", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { user_ids, remove_all } = req.body;

  try {
    if (remove_all) {
      await pool.query(
        "DELETE FROM policy_assignments WHERE policy_id = $1", [id]
      );
    } else {
      for (const userId of user_ids) {
        await pool.query(
          "DELETE FROM policy_assignments WHERE policy_id = $1 AND user_id = $2",
          [id, userId]
        );
      }
    }
    res.json({ message: "Policy removed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



router.get("/:orgId/active-policies", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { orgId } = req.params;
  try {
    const result = await pool.query(`
      SELECT DISTINCT p.* FROM policies p
      WHERE p.organization_id = $1
      AND p.enabled = true
      AND (
        -- Direct assignment to this user
        EXISTS (
          SELECT 1 FROM policy_assignments pa
          WHERE pa.policy_id = p.id AND pa.user_id = $2
        )
        OR
        -- No assignments at all = global policy
        NOT EXISTS (
          SELECT 1 FROM policy_assignments pa
          JOIN users u ON pa.user_id = u.id
          WHERE pa.policy_id = p.id AND u.organization_id = $1
        )
      )
    `, [orgId, userId]);

    res.json({ policies: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ══════════════════════════════════════════
// GET /api/org/policies/:id/assigned-users
// Policy assign users list
// ══════════════════════════════════════════
router.get("/policies/:id/assigned-users", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, d.name AS department
      FROM policy_assignments pa
      JOIN users u ON pa.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE pa.policy_id = $1
    `, [id]);
    res.json({ assigned_users: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// GET /api/org/my-alerts — unread alerts fetch
router.get("/my-alerts", verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT * FROM co2_alerts 
       WHERE recipient_id = $1 
       ORDER BY sent_at DESC 
       LIMIT 20`,
      [userId]
    );
    const unread = result.rows.filter(r => !r.is_read).length;
    res.json({ alerts: result.rows, unread_count: unread });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/org/alerts/mark-read — mark all read
router.patch("/alerts/mark-read", verifyToken, async (req, res) => {
  const userId = req.user.id;
  try {
    await pool.query(
      `UPDATE co2_alerts SET is_read = true WHERE recipient_id = $1`,
      [userId]
    );
    res.json({ message: "All alerts marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;