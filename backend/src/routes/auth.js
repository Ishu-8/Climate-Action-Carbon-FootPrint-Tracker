const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const { sendPasswordResetEmail } = require("../utils/mailer");
const JWT_SECRET = process.env.JWT_SECRET;

// 🔐 LOGIN
router.post("/login", async (req, res) => {
    console.log("Login route hit");
  try {
    const { email, password } = req.body;
    
    // Email format validate
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  return res.status(400).json({ message: "Please enter a valid email address" });
} 

    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    const user = userResult.rows[0];

    // 🔑 Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // 🎟 Generate Token
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        organization_id: user.organization_id,
        name: user.name 
      },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      name: user.name 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});
// 📝 REGISTER
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, org_name, dept } = req.body;

    // system_admin role-ஐ register-ல allow பண்ணாதே
    if (role === "system_admin") {
      return res.status(403).json({ message: "Not allowed" });
    }

    // Email already exists check
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1", [email]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }
    
    

    // Password hash
    const hashed = await bcrypt.hash(password, 10);

    let organization_id = null;
    let department_id = null;

    // Org employee or org admin na — org create or find பண்ணு
    if (role === "org_employee" || role === "org_admin") {
      // Organization check or create
      let orgResult = await pool.query(
        "SELECT id FROM organizations WHERE name = $1", [org_name]
      );
      if (orgResult.rows.length === 0) {
        orgResult = await pool.query(
          "INSERT INTO organizations (name) VALUES ($1) RETURNING id",
          [org_name]
        );
      }
      organization_id = orgResult.rows[0].id;

      // Department check or create
      if (dept) {
        let deptResult = await pool.query(
          "SELECT id FROM departments WHERE name = $1 AND organization_id = $2",
          [dept, organization_id]
        );
        if (deptResult.rows.length === 0) {
          deptResult = await pool.query(
            "INSERT INTO departments (organization_id, name) VALUES ($1, $2) RETURNING id",
            [organization_id, dept]
          );
        }
        department_id = deptResult.rows[0].id;
      }
    }
  
    // User insert
    await pool.query(
      `INSERT INTO users (name, email, password, role, organization_id, department_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [name, email, hashed, role, organization_id, department_id]
    );

    res.json({ message: "Registered successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});
  // GET /api/auth/departments?org_name=xxx
router.get("/departments", async (req, res) => {
  const { org_name } = req.query;
  try {
    const orgResult = await pool.query(
      "SELECT id FROM organizations WHERE LOWER(name) = LOWER($1)",
      [org_name]
    );

    if (orgResult.rows.length === 0) {
      return res.json({ departments: [] });
    }

    const orgId = orgResult.rows[0].id;
    const depts = await pool.query(
      "SELECT name FROM departments WHERE organization_id = $1 ORDER BY name",
      [orgId]
    );

    res.json({ departments: depts.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/organizations", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name FROM organizations ORDER BY name"
    );
    res.json({ organizations: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  console.log("EMAIL_USER:", process.env.EMAIL_USER); // ← add பண்ணு
  console.log("EMAIL_PASS exists:", !!process.env.EMAIL_PASS); // ← add பண்ணு
  console.log("FORGOT PASSWORD CALLED — email:", email);
  try {
    const user = await pool.query(
      "SELECT id, name FROM users WHERE email = $1", [email]
    );
     console.log("USER FOUND:", user.rows);
    if (user.rows.length === 0) {
      // Security — don't reveal if email exists
      return res.json({ message: "Reset link sent if email exists" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await pool.query(
      `UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3`,
      [token, expires, email]
    );
     console.log("TOKEN SAVED — sending email to:", email);
     console.log("ABOUT TO SEND EMAIL:", email, user.rows[0].name);
    await sendPasswordResetEmail(email, user.rows[0].name, token);
    res.json({ message: "Reset link sent if email exists" });
  } catch (err) {
    console.log("ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;
  try {
    const user = await pool.query(
      `SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [token]
    );
    if (user.rows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }
    const bcrypt = require("bcrypt");
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      `UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2`,
      [hashed, user.rows[0].id]
    );
    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;