const pool = require("../config/db");
const { sendChallengeCompleteEmail } = require("../utils/mailer");

const checkChallenges = async () => {
  console.log("🔍 Checking challenges...");
  try {
    // ✅ மாத்தணும் — already points added check பண்ணு:
const participants = await pool.query(`
  SELECT cp.*, 
    u.email, u.name as user_name, u.organization_id,
    c.end_date, c.title as challenge_title
  FROM challenge_participants cp
  JOIN users u ON cp.user_id = u.id
  LEFT JOIN challenges c ON c.challenge_type = cp.challenge_type AND c.is_active = TRUE
  WHERE cp.completed = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM points_history ph 
    WHERE ph.user_id = cp.user_id 
    AND ph.challenge_type = cp.challenge_type
  )
`);

    for (const p of participants.rows) {
      let completed = false;

      const joinedAt = new Date(p.joined_at);

      // CO₂ before joining (baseline)
      const beforeJoin = await pool.query(`
        SELECT 
          COALESCE((SELECT SUM(calculated_co2) FROM transport_activities WHERE user_id = $1 AND created_at < $2), 0) +
          COALESCE((SELECT SUM(calculated_co2) FROM energy_activities WHERE user_id = $1 AND created_at < $2), 0) +
          COALESCE((SELECT SUM(calculated_co2) FROM food_activities WHERE user_id = $1 AND created_at < $2), 0)
        as total
      `, [p.user_id, joinedAt]);

      // CO₂ after joining
      const afterJoin = await pool.query(`
        SELECT 
          COALESCE((SELECT SUM(calculated_co2) FROM transport_activities WHERE user_id = $1 AND created_at >= $2), 0) +
          COALESCE((SELECT SUM(calculated_co2) FROM energy_activities WHERE user_id = $1 AND created_at >= $2), 0) +
          COALESCE((SELECT SUM(calculated_co2) FROM food_activities WHERE user_id = $1 AND created_at >= $2), 0)
        as total
      `, [p.user_id, joinedAt]);

      const beforeTotal = parseFloat(beforeJoin.rows[0].total);
      const afterTotal = parseFloat(afterJoin.rows[0].total);

      console.log(`📊 ${p.user_name} | ${p.challenge_name} | Before: ${beforeTotal} | After: ${afterTotal}`);

      // Specific challenge type conditions
      if (p.challenge_type === "car_free_week") {
        const transportAfter = await pool.query(`
          SELECT COALESCE(SUM(calculated_co2), 0) as total
          FROM transport_activities
          WHERE user_id = $1 AND created_at >= $2
        `, [p.user_id, joinedAt]);
        const transportBefore = await pool.query(`
          SELECT COALESCE(SUM(calculated_co2), 0) as total
          FROM transport_activities
          WHERE user_id = $1 AND created_at < $2
        `, [p.user_id, joinedAt]);
        const tAfter = parseFloat(transportAfter.rows[0].total);
        const tBefore = parseFloat(transportBefore.rows[0].total);
        if (tBefore > 0 && tAfter < tBefore * 0.5) completed = true;
        else if (tBefore === 0 && tAfter === 0) completed = true;

      } else if (p.challenge_type === "veg_month") {
        const foodAfter = await pool.query(`
          SELECT COALESCE(SUM(calculated_co2), 0) as total
          FROM food_activities
          WHERE user_id = $1 AND created_at >= $2
        `, [p.user_id, joinedAt]);
        const foodBefore = await pool.query(`
          SELECT COALESCE(SUM(calculated_co2), 0) as total
          FROM food_activities
          WHERE user_id = $1 AND created_at < $2
        `, [p.user_id, joinedAt]);
        const fAfter = parseFloat(foodAfter.rows[0].total);
        const fBefore = parseFloat(foodBefore.rows[0].total);
        if (fBefore > 0 && fAfter < fBefore * 0.7) completed = true;
        else if (fBefore === 0 && fAfter === 0) completed = true;

      } else if (p.challenge_type === "ac_minimizer") {
        const energyAfter = await pool.query(`
          SELECT COALESCE(SUM(calculated_co2), 0) as total
          FROM energy_activities
          WHERE user_id = $1 AND created_at >= $2
        `, [p.user_id, joinedAt]);
        const energyBefore = await pool.query(`
          SELECT COALESCE(SUM(calculated_co2), 0) as total
          FROM energy_activities
          WHERE user_id = $1 AND created_at < $2
        `, [p.user_id, joinedAt]);
        const eAfter = parseFloat(energyAfter.rows[0].total);
        const eBefore = parseFloat(energyBefore.rows[0].total);
        if (eBefore > 0 && eAfter < eBefore * 0.5) completed = true;
        else if (eBefore === 0 && eAfter === 0) completed = true;

      } else {
        // Custom challenge — overall CO₂ reduction
        if (beforeTotal > 0 && afterTotal < beforeTotal * 0.3) completed = true;
        else if (beforeTotal === 0 && afterTotal === 0) completed = true;
        else if (beforeTotal > 0 && afterTotal === 0) completed = true;
      }

      if (completed) {
        // Mark complete
        await pool.query(
          `UPDATE challenge_participants SET completed = TRUE, completed_at = NOW() WHERE id = $1`,
          [p.id]
        );

        // Add points
        await pool.query(`
          INSERT INTO user_points (user_id, total_points, badge, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (user_id) DO UPDATE
          SET total_points = user_points.total_points + $2,
              badge = CASE WHEN user_points.total_points + $2 >= 1000 THEN '🏆 Eco Champion'
                           WHEN user_points.total_points + $2 >= 500 THEN '🌟 Green Star'
                           ELSE '🌱 Eco Starter' END,
              updated_at = NOW()
        `, [p.user_id, p.points, '🌱 Eco Starter']);

        // Points history
        await pool.query(
          `INSERT INTO points_history (user_id, points, reason, challenge_type)
           VALUES ($1, $2, $3, $4)`,
          [p.user_id, p.points, `Completed: ${p.challenge_name}`, p.challenge_type]
        );

        console.log(`✅ ${p.user_name} completed ${p.challenge_name}!`);

        // Send email
        const isOrgEmp = p.organization_id !== null;
        await sendChallengeCompleteEmail(
          p.email, p.user_name, p.challenge_name, p.points, isOrgEmp
        );
      }
    }
    console.log("✅ Challenge monitor complete!");
  } catch (err) {
    console.error("Challenge monitor error:", err.message);
  }
};

module.exports = { checkChallenges };