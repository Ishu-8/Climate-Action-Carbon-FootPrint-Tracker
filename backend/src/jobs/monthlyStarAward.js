const cron = require("node-cron");
const pool = require("../config/db");
const { sendStarAwardEmail } = require("../utils/mailer");

const startMonthlyStarAward = () => {
  // Every month 1st — 9:00 AM
  cron.schedule("0 9 1 * *", async () => {
    console.log("⭐ Monthly Star Award running...");
    try {
      const month = new Date().getMonth(); // previous month
      const year = new Date().getFullYear();
      const prevMonth = month === 0 ? 12 : month;

      const prevYear = month === 0 ? year - 1 : year;

      // Already ran check
      const alreadyRan = await pool.query(
        `SELECT 1 FROM leaderboard_stars_log WHERE month=$1 AND year=$2`,
        [prevMonth, prevYear]
      );
      if (alreadyRan.rows.length > 0) {
        console.log("⭐ Stars already awarded this month.");
        return;
      }

      // Top 2 Individual
      const topIndividual = await pool.query(`
        SELECT u.id, u.name, u.email,
          COALESCE((SELECT SUM(calculated_co2) FROM transport_activities WHERE user_id=u.id AND DATE_TRUNC('month', created_at)=DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')),0) +
          COALESCE((SELECT SUM(calculated_co2) FROM energy_activities WHERE user_id=u.id AND DATE_TRUNC('month', created_at)=DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')),0) +
          COALESCE((SELECT SUM(calculated_co2) FROM food_activities WHERE user_id=u.id AND DATE_TRUNC('month', created_at)=DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')),0)
          AS monthly_co2
        FROM users u
        WHERE u.role = 'individual'
        ORDER BY monthly_co2 ASC
        LIMIT 2
      `);

      // Top 2 Org Employee
      const topOrgEmp = await pool.query(`
        SELECT u.id, u.name, u.email,
          COALESCE((SELECT SUM(calculated_co2) FROM transport_activities WHERE user_id=u.id AND DATE_TRUNC('month', created_at)=DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')),0) +
          COALESCE((SELECT SUM(calculated_co2) FROM energy_activities WHERE user_id=u.id AND DATE_TRUNC('month', created_at)=DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')),0) +
          COALESCE((SELECT SUM(calculated_co2) FROM food_activities WHERE user_id=u.id AND DATE_TRUNC('month', created_at)=DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')),0)
          AS monthly_co2
        FROM users u
        WHERE u.role = 'org_employee'
        ORDER BY monthly_co2 ASC
        LIMIT 2
      `);

      const winners = [...topIndividual.rows, ...topOrgEmp.rows];

      for (const w of winners) {
        // ⭐ Star add
        await pool.query(`
          INSERT INTO leaderboard_stars (user_id, stars)
          VALUES ($1, 1)
          ON CONFLICT (user_id) DO UPDATE SET stars = leaderboard_stars.stars + 1
        `, [w.id]);

        // 🔔 Dashboard notification
        await pool.query(`
          INSERT INTO co2_alerts (user_id, recipient_id, total_co2, message, is_read, alert_type, sent_at)
          VALUES ($1, $1, 0, $2, false, 'star_awarded', NOW())
        `, [w.id, `⭐ Congratulations! You earned a star for lowest CO₂ in ${new Date(Date.now() - 30*24*60*60*1000).toLocaleString('en-IN', {month:'long', year:'numeric'})}!`]);

        // 📧 Email
        await sendStarAwardEmail(w.email, w.name, prevMonth, prevYear);

        console.log(`⭐ Star awarded to ${w.name}!`);
      }

      // Log
      await pool.query(
        `INSERT INTO leaderboard_stars_log (month, year) VALUES ($1, $2)`,
        [prevMonth, prevYear]
      );

      console.log(`✅ Monthly stars awarded to ${winners.length} users!`);
    } catch (err) {
      console.error("Monthly star award error:", err.message);
    }
  });

  console.log("⭐ Monthly Star Award cron job started!");
};

module.exports = { startMonthlyStarAward };