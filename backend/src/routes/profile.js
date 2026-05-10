const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const verifyToken = require("../middleware/authMiddleware");
const bcrypt = require("bcrypt");

// GET /api/profile
router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.role,
        u.profile_pic,
        o.name AS org_name, d.name AS dept_name,
        u.created_at
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = $1
    `, [req.user.id]);
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/profile/update
router.patch("/update", verifyToken, async (req, res) => {
  const { name, email } = req.body;
  try {
    if (email) {
      const existing = await pool.query(
        `SELECT id FROM users WHERE email=$1 AND id != $2`,
        [email, req.user.id]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ message: "Email already in use!" });
      }
    }
    await pool.query(
      `UPDATE users SET name=$1, email=$2 WHERE id=$3`,
      [name, email, req.user.id]
    );
    res.json({ message: "Profile updated successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/profile/change-password
router.patch("/change-password", verifyToken, async (req, res) => {
  const { current_password, new_password } = req.body;
  try {
    const result = await pool.query(
      `SELECT password FROM users WHERE id=$1`,
      [req.user.id]
    );
    const valid = await bcrypt.compare(current_password, result.rows[0].password);
    if (!valid) {
      return res.status(400).json({ message: "Current password is incorrect!" });
    }
    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query(
      `UPDATE users SET password=$1 WHERE id=$2`,
      [hashed, req.user.id]
    );
    res.json({ message: "Password changed successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/profile/upload-pic
router.patch("/upload-pic", verifyToken, async (req, res) => {
  const { profile_pic } = req.body;
  try {
    if (!profile_pic) {
      return res.status(400).json({ message: "No image provided!" });
    }
    // 2MB limit check
    const sizeInBytes = Buffer.byteLength(profile_pic, "utf8");
    if (sizeInBytes > 2 * 1024 * 1024) {
      return res.status(400).json({ message: "Image too large! Max 2MB." });
    }
    await pool.query(
      `UPDATE users SET profile_pic=$1 WHERE id=$2`,
      [profile_pic, req.user.id]
    );
    res.json({ message: "Profile picture updated!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;