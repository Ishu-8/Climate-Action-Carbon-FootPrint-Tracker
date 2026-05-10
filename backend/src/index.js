console.log("THIS INDEX FILE IS RUNNING");
require("dotenv").config({ path: "../.env" });

const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
const app = express();

// ✅ CORS 
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));

app.use(express.json());

// ✅ Test route
app.get("/", (req, res) => {
  res.send("Climate Action CO2 Tracker Backend Running ✅");
});

// ✅ Routes
const transportRoutes = require("./routes/transport");
app.use("/api/transport", transportRoutes);

const energyRoutes = require("./routes/energy");
app.use("/api/energy", energyRoutes);

const foodRoutes = require("./routes/food");
app.use("/api/food", foodRoutes);

const summaryRoutes = require("./routes/summary");
app.use("/api/summary", summaryRoutes);

const authRoutes = require("./routes/auth");
console.log("Auth route loaded");
app.use("/api/auth", authRoutes);  // ✅ /auth → /api/auth

const environmentRoutes = require("./routes/environment");
app.use("/api/environment", environmentRoutes);

const adminRoutes = require("./routes/admin");
app.use("/api/admin", adminRoutes);

const orgRoutes = require("./routes/org");
app.use("/api/org", orgRoutes);

const challengeRoutes = require("./routes/challenges");
app.use("/api/challenges", challengeRoutes);

const cron = require("node-cron");
const { checkChallenges } = require("./jobs/challengeMonitor");

const reportRoute = require("./routes/report");
app.use("/api/report", reportRoute);

const leaderboardRoute = require("./routes/leaderboard");
app.use("/api/leaderboard", leaderboardRoute);

const profileRoute = require("./routes/profile");
app.use("/api/profile", profileRoute);

const { startMonthlyStarAward } = require("./jobs/monthlyStarAward");
startMonthlyStarAward();

// Daily midnight — end date expired challenges check
cron.schedule("0 0 * * *", () => {
  console.log("⏰ Daily cron: checking expired challenges...");
  checkChallenges();
});

// Every hour — check if any challenge end date passed
cron.schedule("0 * * * *", () => {
  console.log("⏰ Hourly cron: checking end dates...");
  checkChallenges();
});
// DB Test
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      message: "Database connected successfully",
      time: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database connection failed" });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});