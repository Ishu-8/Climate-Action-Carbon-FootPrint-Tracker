const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ✅ Verify connection
transporter.verify((error, success) => {
  if (error) {
    console.log("❌ MAILER ERROR:", error.message);
  } else {
    console.log("✅ MAILER READY — Gmail connected!");
  }
});

const sendCO2Alert = async ({ toEmail, userName, totalCO2, category, limit }) => {
  const subject = `⚠️ CO₂ Alert: You've exceeded your daily limit!`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', sans-serif; background: #04100d; color: #e8f5e9; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 30px auto; background: #0a1f14; border-radius: 18px; overflow: hidden; border: 1px solid rgba(76,175,130,0.2); }
        .header { background: linear-gradient(135deg, #1b5e40, #0a3d20); padding: 30px; text-align: center; }
        .header h1 { color: #4caf82; font-size: 22px; margin: 0; }
        .header p { color: rgba(232,245,233,0.6); font-size: 13px; margin: 8px 0 0; }
        .body { padding: 28px 30px; }
        .alert-box { background: rgba(235,87,87,0.12); border: 1px solid rgba(235,87,87,0.3); border-radius: 12px; padding: 18px; margin-bottom: 22px; text-align: center; }
        .alert-box .co2-value { color: #eb5757; font-size: 38px; font-weight: 900; letter-spacing: -2px; }
        .alert-box .co2-label { color: rgba(232,245,233,0.5); font-size: 12px; margin-top: 4px; }
        .stats { display: flex; gap: 12px; margin-bottom: 22px; }
        .stat { flex: 1; background: rgba(255,255,255,0.04); border-radius: 10px; padding: 14px; text-align: center; border: 1px solid rgba(255,255,255,0.07); }
        .stat .val { color: #e8f5e9; font-size: 18px; font-weight: 800; }
        .stat .lbl { color: rgba(232,245,233,0.4); font-size: 11px; margin-top: 4px; }
        .tips { background: rgba(76,175,130,0.08); border: 1px solid rgba(76,175,130,0.2); border-radius: 12px; padding: 18px; margin-bottom: 22px; }
        .tips h3 { color: #4caf82; font-size: 13px; margin: 0 0 12px; }
        .tip { color: rgba(232,245,233,0.7); font-size: 12px; margin-bottom: 8px; line-height: 1.5; }
        .footer { text-align: center; padding: 20px; border-top: 1px solid rgba(255,255,255,0.06); }
        .footer p { color: rgba(232,245,233,0.3); font-size: 11px; margin: 0; }
        .badge { display: inline-block; background: rgba(235,87,87,0.15); color: #eb5757; border-radius: 20px; padding: 4px 14px; font-size: 12px; font-weight: 700; margin-bottom: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌿 ClimaTrack</h1>
          <p>Carbon Footprint Alert</p>
        </div>
        <div class="body">
          <p style="color:rgba(232,245,233,0.7); font-size:14px; margin-bottom:20px;">
            Hi <strong style="color:#e8f5e9">${userName}</strong>, your CO₂ emissions today have exceeded the recommended daily limit.
          </p>

          <div class="alert-box">
            <div class="badge">⚠️ LIMIT EXCEEDED</div>
            <div class="co2-value">${totalCO2.toFixed(2)} kg</div>
            <div class="co2-label">Today's Total CO₂ Emission</div>
          </div>

          <table style="width:100%; border-collapse:separate; border-spacing:10px; margin-bottom:22px;">
            <tr>
              <td style="background:rgba(255,255,255,0.04); border-radius:10px; padding:14px; text-align:center; border:1px solid rgba(255,255,255,0.07);">
                <div style="color:#eb5757; font-size:18px; font-weight:800;">${totalCO2.toFixed(2)} kg</div>
                <div style="color:rgba(232,245,233,0.4); font-size:11px; margin-top:4px;">Your CO₂</div>
              </td>
              <td style="background:rgba(255,255,255,0.04); border-radius:10px; padding:14px; text-align:center; border:1px solid rgba(255,255,255,0.07);">
                <div style="color:#4caf82; font-size:18px; font-weight:800;">${limit} kg</div>
                <div style="color:rgba(232,245,233,0.4); font-size:11px; margin-top:4px;">Daily Limit</div>
              </td>
              <td style="background:rgba(255,255,255,0.04); border-radius:10px; padding:14px; text-align:center; border:1px solid rgba(255,255,255,0.07);">
                <div style="color:#f2994a; font-size:18px; font-weight:800;">+${(totalCO2 - limit).toFixed(2)} kg</div>
                <div style="color:rgba(232,245,233,0.4); font-size:11px; margin-top:4px;">Exceeded By</div>
              </td>
            </tr>
          </table>

          <div class="tips">
            <h3>💡 Reduce Your CO₂ Tomorrow</h3>
            <div class="tip">🚌 Switch to public transport or carpool to reduce transport emissions</div>
            <div class="tip">☀️ Use solar or renewable energy sources when possible</div>
            <div class="tip">🥦 Choose plant-based meals — they emit up to 70% less CO₂</div>
            <div class="tip">🏠 Consider working from home to eliminate commute emissions</div>
          </div>

          <p style="color:rgba(232,245,233,0.4); font-size:11px; text-align:center;">
            You'll receive this alert whenever your daily CO₂ exceeds <strong style="color:#4caf82">${limit} kg</strong>
          </p>
        </div>
        <div class="footer">
          <p>ClimaTrack · Carbon Footprint Tracker · Track • Reduce • Restore</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"ClimaTrack 🌿" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject,
    html,
  });
};
// ── Admin Alert ──────────────────────────
const sendAdminCO2Alert = async ({ toEmail, adminName, employeeName, employeeEmail, totalCO2, limit, orgName }) => {
  const subject = `⚠️ Employee CO₂ Alert: ${employeeName} exceeded daily limit`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', sans-serif; background: #04100d; color: #e8f5e9; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 30px auto; background: #0a1f14; border-radius: 18px; overflow: hidden; border: 1px solid rgba(76,175,130,0.2); }
        .header { background: linear-gradient(135deg, #1b5e40, #0a3d20); padding: 30px; text-align: center; }
        .header h1 { color: #4caf82; font-size: 22px; margin: 0; }
        .body { padding: 28px 30px; }
        .alert-box { background: rgba(235,87,87,0.12); border: 1px solid rgba(235,87,87,0.3); border-radius: 12px; padding: 18px; margin-bottom: 22px; text-align: center; }
        .co2-value { color: #eb5757; font-size: 38px; font-weight: 900; letter-spacing: -2px; }
        .co2-label { color: rgba(232,245,233,0.5); font-size: 12px; margin-top: 4px; }
        .emp-box { background: rgba(155,135,245,0.1); border: 1px solid rgba(155,135,245,0.3); border-radius: 12px; padding: 16px; margin-bottom: 20px; }
        .footer { text-align: center; padding: 20px; border-top: 1px solid rgba(255,255,255,0.06); }
        .footer p { color: rgba(232,245,233,0.3); font-size: 11px; margin: 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌿 ClimaTrack — Admin Alert</h1>
          <p>Employee CO₂ Limit Exceeded</p>
        </div>
        <div class="body">
          <p style="color:rgba(232,245,233,0.7); font-size:14px; margin-bottom:20px;">
            Hi <strong style="color:#e8f5e9">${adminName}</strong>, an employee in your organization has exceeded the daily CO₂ limit.
          </p>

          <div class="emp-box">
            <div style="color:#9b87f5; font-size:13px; font-weight:700; margin-bottom:6px;">👷 Employee Details</div>
            <div style="color:#e8f5e9; font-size:15px; font-weight:800;">${employeeName}</div>
            <div style="color:rgba(232,245,233,0.5); font-size:12px; margin-top:4px;">📧 ${employeeEmail}</div>
            ${orgName ? `<div style="color:rgba(232,245,233,0.5); font-size:12px; margin-top:4px;">🏢 ${orgName}</div>` : ""}
          </div>

          <div class="alert-box">
            <div style="color:#eb5757; font-size:13px; font-weight:700; margin-bottom:8px;">⚠️ CO₂ LIMIT EXCEEDED</div>
            <div class="co2-value">${totalCO2.toFixed(2)} kg</div>
            <div class="co2-label">Today's Total CO₂</div>
          </div>

          <table style="width:100%; border-collapse:separate; border-spacing:10px; margin-bottom:22px;">
            <tr>
              <td style="background:rgba(255,255,255,0.04); border-radius:10px; padding:14px; text-align:center; border:1px solid rgba(255,255,255,0.07);">
                <div style="color:#eb5757; font-size:18px; font-weight:800;">${totalCO2.toFixed(2)} kg</div>
                <div style="color:rgba(232,245,233,0.4); font-size:11px; margin-top:4px;">Employee CO₂</div>
              </td>
              <td style="background:rgba(255,255,255,0.04); border-radius:10px; padding:14px; text-align:center; border:1px solid rgba(255,255,255,0.07);">
                <div style="color:#4caf82; font-size:18px; font-weight:800;">${limit} kg</div>
                <div style="color:rgba(232,245,233,0.4); font-size:11px; margin-top:4px;">Daily Limit</div>
              </td>
              <td style="background:rgba(255,255,255,0.04); border-radius:10px; padding:14px; text-align:center; border:1px solid rgba(255,255,255,0.07);">
                <div style="color:#f2994a; font-size:18px; font-weight:800;">+${(totalCO2 - limit).toFixed(2)} kg</div>
                <div style="color:rgba(232,245,233,0.4); font-size:11px; margin-top:4px;">Exceeded By</div>
              </td>
            </tr>
          </table>

          <p style="color:rgba(232,245,233,0.4); font-size:11px; text-align:center;">
            Please consider enabling relevant policies in your organization dashboard to reduce emissions.
          </p>
        </div>
        <div class="footer">
          <p>ClimaTrack · Carbon Footprint Tracker · Track • Reduce • Restore</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"ClimaTrack 🌿" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject,
    html,
  });
};

const sendPasswordResetEmail = async (email, name, token) => {
  const resetLink = `http://localhost:3000/reset-password?token=${token}`;
  await transporter.sendMail({
    from: `"ClimaTrack" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset Your ClimaTrack Password",
    html: `
      <div style="background:#04100d;padding:40px;font-family:sans-serif;color:#e8f5e9;">
        <h2 style="color:#4caf82;">🔐 Password Reset Request</h2>
        <p>Hi ${name},</p>
        <p>Click the button below to reset your password. Link expires in 1 hour.</p>
        <a href="${resetLink}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#4caf82;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">
          Reset Password →
        </a>
        <p style="color:#5d7a65;font-size:12px;">If you didn't request this, ignore this email.</p>
      </div>
    `
  });
};

// Challenge Complete Email
const sendChallengeCompleteEmail = async (email, name, challengeName, points, isOrgEmployee = false) => {
  await transporter.sendMail({
    from: `"ClimaTrack 🌿" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `🏆 Challenge Complete! You earned ${points} pts`,
    html: `
      <div style="background:#04100d;padding:40px;font-family:sans-serif;color:#e8f5e9;max-width:560px;margin:0 auto;border-radius:18px;">
        <h1 style="color:#4caf82;text-align:center;">🌿 ClimaTrack</h1>
        <div style="text-align:center;margin:24px 0;">
          <div style="font-size:60px;">🏆</div>
          <h2 style="color:#e8f5e9;">Challenge Complete!</h2>
        </div>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Congratulations! You've successfully completed the <strong style="color:#4caf82;">${challengeName}</strong> challenge!</p>
        <div style="background:rgba(76,175,130,0.12);border:1px solid rgba(76,175,130,0.3);border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
          <div style="color:#4caf82;font-size:36px;font-weight:900;">+${points} pts</div>
          <div style="color:rgba(232,245,233,0.5);font-size:13px;margin-top:4px;">Eco Points Earned</div>
        </div>
        ${isOrgEmployee ? `
        <div style="background:rgba(155,135,245,0.12);border:1px solid rgba(155,135,245,0.3);border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
          <div style="color:#9b87f5;font-size:24px;font-weight:900;">🎉 5% Salary Increment!</div>
          <div style="color:rgba(232,245,233,0.6);font-size:13px;margin-top:8px;">Your organization will process a symbolic 5% salary increment for your eco efforts!</div>
        </div>
        ` : ""}
        <p style="color:rgba(232,245,233,0.5);font-size:12px;text-align:center;">Keep going — more challenges await! 🌱</p>
        <p style="color:rgba(232,245,233,0.3);font-size:11px;text-align:center;">ClimaTrack · Track • Reduce • Restore</p>
      </div>
    `
  });
};

// Low CO₂ Achievement Email
const sendLowCO2AchievementEmail = async (email, name, totalCO2, points, badge) => {
  await transporter.sendMail({
    from: `"ClimaTrack 🌿" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `🌱 Amazing! Low CO₂ Achievement — ${points} pts earned!`,
    html: `
      <div style="background:#04100d;padding:40px;font-family:sans-serif;color:#e8f5e9;max-width:560px;margin:0 auto;border-radius:18px;">
        <h1 style="color:#4caf82;text-align:center;">🌿 ClimaTrack</h1>
        <div style="text-align:center;margin:24px 0;">
          <div style="font-size:60px;">🌱</div>
          <h2 style="color:#4caf82;">Low CO₂ Achievement!</h2>
        </div>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Excellent work! Your CO₂ emission today is remarkably low!</p>
        <div style="background:rgba(76,175,130,0.12);border:1px solid rgba(76,175,130,0.3);border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
          <div style="color:#4caf82;font-size:36px;font-weight:900;">${totalCO2} kg</div>
          <div style="color:rgba(232,245,233,0.5);font-size:13px;">Today's CO₂ Emission</div>
          <div style="margin-top:16px;color:#f2994a;font-size:24px;font-weight:900;">+${points} pts</div>
          ${badge ? `<div style="color:#e8f5e9;font-size:16px;margin-top:8px;">${badge}</div>` : ""}
        </div>
        <p style="color:rgba(232,245,233,0.5);font-size:12px;text-align:center;">Keep maintaining low emissions — every kg matters! 🌍</p>
        <p style="color:rgba(232,245,233,0.3);font-size:11px;text-align:center;">ClimaTrack · Track • Reduce • Restore</p>
      </div>
    `
  });
};
const sendStarAwardEmail = async (email, name, month, year) => {
  const monthName = new Date(year, month - 1).toLocaleString('en-IN', { month: 'long' });
  await transporter.sendMail({
    from: `"ClimaTrack 🌿" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `⭐ You earned a Star! — ${monthName} ${year} Leaderboard`,
    html: `
      <div style="background:#04100d;padding:40px;font-family:sans-serif;color:#e8f5e9;max-width:560px;margin:0 auto;border-radius:18px;">
        <h1 style="color:#4caf82;text-align:center;">🌿 ClimaTrack</h1>
        <div style="text-align:center;margin:24px 0;">
          <div style="font-size:60px;">⭐</div>
          <h2 style="color:#f2c94c;">Star Awarded!</h2>
        </div>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Congratulations! You had the <strong style="color:#4caf82;">lowest CO₂ emissions</strong> in ${monthName} ${year}!</p>
        <div style="background:rgba(242,201,76,0.12);border:1px solid rgba(242,201,76,0.3);border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
          <div style="color:#f2c94c;font-size:48px;">⭐</div>
          <div style="color:#f2c94c;font-size:20px;font-weight:900;margin-top:8px;">Monthly Star Earned!</div>
          <div style="color:rgba(232,245,233,0.5);font-size:13px;margin-top:4px;">${monthName} ${year} — Top CO₂ Reducer</div>
        </div>
        <p style="color:rgba(232,245,233,0.5);font-size:12px;text-align:center;">Keep reducing emissions — collect more stars! 🌍</p>
        <p style="color:rgba(232,245,233,0.3);font-size:11px;text-align:center;">ClimaTrack · Track • Reduce • Restore</p>
      </div>
    `
  });
};
module.exports = { sendCO2Alert, sendAdminCO2Alert, sendPasswordResetEmail, sendChallengeCompleteEmail, sendLowCO2AchievementEmail,sendStarAwardEmail };