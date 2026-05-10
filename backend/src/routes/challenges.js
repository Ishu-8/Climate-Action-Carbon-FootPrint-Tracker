const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const verifyToken = require("../middleware/authMiddleware");

// POST /api/challenges/join
router.post("/join", verifyToken, async (req, res) => {
  const { challenge_type, challenge_name, points } = req.body;
  const user_id = req.user.id;
  try {
    const existing = await pool.query(
      "SELECT id FROM challenge_participants WHERE user_id = $1 AND challenge_type = $2",
      [user_id, challenge_type]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Already joined this challenge" });
    }
   // Challenge duration fetch
const chRes = await pool.query(
  `SELECT duration_days FROM challenges WHERE challenge_type = $1 AND is_active = TRUE`,
  [challenge_type]
);
const duration = chRes.rows[0]?.duration_days || 7;
const endDate = new Date();
endDate.setDate(endDate.getDate() + duration);

await pool.query(
  `INSERT INTO challenge_participants (user_id, challenge_type, challenge_name, points, end_date)
   VALUES ($1, $2, $3, $4, $5)`,
  [user_id, challenge_type, challenge_name, points, endDate]
);
    res.json({ message: "Challenge joined!", challenge_type });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/challenges/my
router.get("/my", verifyToken, async (req, res) => {
  const user_id = req.user.id;
  try {
    const result = await pool.query(
      "SELECT * FROM challenge_participants WHERE user_id = $1",
      [user_id]
    );
    res.json({ challenges: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/challenges/my-points
router.get("/my-points", verifyToken, async (req, res) => {
  const user_id = req.user.id;
  try {
    const result = await pool.query(
      "SELECT * FROM user_points WHERE user_id = $1", [user_id]
    );
    res.json({ points: result.rows[0] || { total_points: 0, badge: null } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/challenges/admin-stats (system admin)
router.get("/admin-stats", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        challenge_name,
        challenge_type,
        COUNT(*) as participants,
        SUM(CASE WHEN completed THEN 1 ELSE 0 END) as completed_count,
        points
      FROM challenge_participants
      GROUP BY challenge_name, challenge_type, points
      ORDER BY participants DESC
    `);
    res.json({ stats: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/challenges/org-stats/:orgId (org admin)
router.get("/org-stats/:orgId", verifyToken, async (req, res) => {
  const { orgId } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        u.name, u.email, u.department_id,
        d.name as department,
        cp.challenge_name, cp.challenge_type,
        cp.completed, cp.joined_at, cp.points,
        cp.completed_at
      FROM challenge_participants cp
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.organization_id = $1
      ORDER BY cp.joined_at DESC
    `, [orgId]);
    res.json({ participants: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/challenges/all-participants (system admin)
router.get("/all-participants", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        cp.id, cp.challenge_name, cp.challenge_type,
        cp.completed, cp.joined_at, cp.points,
        u.name as user_name, u.email,
        d.name as department,
        o.name as organization
      FROM challenge_participants cp
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN organizations o ON u.organization_id = o.id
      ORDER BY cp.joined_at DESC
    `);
    res.json({ participants: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// GET /api/challenges/all — all active challenges
router.get("/all", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM challenges WHERE is_active = TRUE ORDER BY created_at DESC`
    );
    res.json({ challenges: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/challenges/create — system admin only
router.post("/create", verifyToken, async (req, res) => {
  if (req.user.role !== "system_admin") {
    return res.status(403).json({ message: "Access denied" });
  }
  const { title, description, challenge_type, points, emoji, end_date, duration_days } = req.body;
  try {
    const result = await pool.query(
     `INSERT INTO challenges (title, description, challenge_type, points, emoji, end_date, duration_days, created_by)
 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
[title, description, challenge_type, points, emoji, end_date, duration_days || 7, req.user.id]
    );
    res.json({ challenge: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/challenges/:id — system admin only
router.delete("/:id", verifyToken, async (req, res) => {
  if (req.user.role !== "system_admin") {
    return res.status(403).json({ message: "Access denied" });
  }
  try {
    await pool.query(`UPDATE challenges SET is_active = FALSE WHERE id = $1`, [req.params.id]);
    res.json({ message: "Challenge removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/challenges/:id/participants
router.get("/:id/participants", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cp.*, u.name as user_name, u.email, d.name as department
      FROM challenge_participants cp
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE cp.challenge_type = (SELECT challenge_type FROM challenges WHERE id = $1)
      ORDER BY cp.joined_at DESC
    `, [req.params.id]);
    res.json({ participants: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/challenges/:id/remove-user/:userId — system admin only
router.delete("/:id/remove-user/:userId", verifyToken, async (req, res) => {
  if (req.user.role !== "system_admin") {
    return res.status(403).json({ message: "Access denied" });
  }
  try {
    const ch = await pool.query(`SELECT challenge_type FROM challenges WHERE id = $1`, [req.params.id]);
    await pool.query(
      `DELETE FROM challenge_participants WHERE user_id = $1 AND challenge_type = $2`,
      [req.params.userId, ch.rows[0].challenge_type]
    );
    res.json({ message: "User removed from challenge" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/challenges/run-monitor — manual trigger (dev/test)
router.post("/run-monitor", verifyToken, async (req, res) => {
  if (req.user.role !== "system_admin") {
    return res.status(403).json({ message: "Access denied" });
  }
  try {
    const { checkChallenges } = require("../jobs/challengeMonitor");
    await checkChallenges();
    res.json({ message: "Challenge monitor ran successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;