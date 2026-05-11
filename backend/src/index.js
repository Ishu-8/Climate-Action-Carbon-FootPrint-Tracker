console.log("THIS INDEX FILE IS RUNNING");
require("dotenv").config({ path: "../.env" });

const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
const app = express();

// ✅ CORS
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://climate-action-carbon-foot-print-tr.vercel.app",
    process.env.FRONTEND_URL || "http://localhost:3000"
  ],
  credentials: true
}));

app.use(express.json({ limit: "10mb" }));

// ✅ Test route
app.get("/", (req, res) => {
  res.send("Climate Action CO2 Tracker Backend Running ✅");
});

// ✅ One-time migration route
app.get("/migrate", async (req, res) => {
  const schema = `
    CREATE TABLE IF NOT EXISTS public.organizations (id SERIAL PRIMARY KEY, name character varying(150) NOT NULL, created_at timestamp DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS public.departments (id SERIAL PRIMARY KEY, organization_id integer REFERENCES public.organizations(id), name character varying(100) NOT NULL);
    CREATE TABLE IF NOT EXISTS public.users (id SERIAL PRIMARY KEY, organization_id integer REFERENCES public.organizations(id), department_id integer REFERENCES public.departments(id), name character varying(100) NOT NULL, email character varying(150) NOT NULL UNIQUE, role character varying(50) CHECK (role IN ('individual','org_employee','org_admin','system_admin')), created_at timestamp DEFAULT CURRENT_TIMESTAMP, password character varying(255), reset_token character varying(255), reset_token_expires timestamp, profile_pic text);
    CREATE TABLE IF NOT EXISTS public.transport_emission_factors (id SERIAL PRIMARY KEY, vehicle_type character varying(100), fuel_type character varying(100), emission_factor double precision NOT NULL);
    CREATE TABLE IF NOT EXISTS public.energy_emission_factors (id SERIAL PRIMARY KEY, energy_source character varying(100), emission_factor double precision NOT NULL);
    CREATE TABLE IF NOT EXISTS public.food_emission_factors (id SERIAL PRIMARY KEY, meal_type character varying(100), emission_factor double precision NOT NULL);
    CREATE TABLE IF NOT EXISTS public.adjustment_factors (id SERIAL PRIMARY KEY, category character varying(50), factor_name character varying(100), multiplier double precision NOT NULL);
    CREATE TABLE IF NOT EXISTS public.transport_activities (id SERIAL PRIMARY KEY, user_id integer REFERENCES public.users(id), organization_id integer REFERENCES public.organizations(id), transport_factor_id integer REFERENCES public.transport_emission_factors(id), distance_km double precision NOT NULL, employee_count integer, traffic_level character varying(20), road_type character varying(20), ac_used boolean, base_factor double precision, adjustment_factor double precision, calculated_co2 double precision, created_at timestamp DEFAULT CURRENT_TIMESTAMP, vehicle_age character varying(20), weather character varying(20));
    CREATE TABLE IF NOT EXISTS public.energy_activities (id SERIAL PRIMARY KEY, user_id integer REFERENCES public.users(id), organization_id integer REFERENCES public.organizations(id), energy_factor_id integer REFERENCES public.energy_emission_factors(id), units_consumed double precision NOT NULL, base_factor double precision, adjustment_factor double precision, calculated_co2 double precision, created_at timestamp DEFAULT CURRENT_TIMESTAMP, solar_enabled boolean DEFAULT false, peak_hours character varying(20), season character varying(20));
    CREATE TABLE IF NOT EXISTS public.food_activities (id SERIAL PRIMARY KEY, user_id integer REFERENCES public.users(id), organization_id integer REFERENCES public.organizations(id), food_factor_id integer REFERENCES public.food_emission_factors(id), quantity double precision NOT NULL, base_factor double precision, adjustment_factor double precision, calculated_co2 double precision, created_at timestamp DEFAULT CURRENT_TIMESTAMP, meal_source character varying(20), cooking_method character varying(20), is_organic boolean DEFAULT false);
    CREATE TABLE IF NOT EXISTS public.policies (id SERIAL PRIMARY KEY, organization_id integer REFERENCES public.organizations(id), policy_name character varying(150), impact_factor double precision, created_at timestamp DEFAULT CURRENT_TIMESTAMP, enabled boolean DEFAULT false, description text);
    CREATE TABLE IF NOT EXISTS public.policy_assignments (id SERIAL PRIMARY KEY, policy_id integer REFERENCES public.policies(id) ON DELETE CASCADE, user_id integer REFERENCES public.users(id) ON DELETE CASCADE, assigned_at timestamp DEFAULT CURRENT_TIMESTAMP, UNIQUE(policy_id, user_id));
    CREATE TABLE IF NOT EXISTS public.co2_alerts (id SERIAL PRIMARY KEY, user_id integer REFERENCES public.users(id) ON DELETE CASCADE, total_co2 numeric(10,3), sent_at timestamp DEFAULT CURRENT_TIMESTAMP, recipient_id integer REFERENCES public.users(id), message text, is_read boolean DEFAULT false, alert_type character varying(50) DEFAULT 'co2_exceeded');
    CREATE TABLE IF NOT EXISTS public.alerts (id SERIAL PRIMARY KEY, user_id integer REFERENCES public.users(id), organization_id integer REFERENCES public.organizations(id), message text, alert_type character varying(50), created_at timestamp DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS public.challenges (id SERIAL PRIMARY KEY, title character varying(200) NOT NULL, description text, challenge_type character varying(100) NOT NULL, points integer DEFAULT 100 NOT NULL, emoji character varying(10) DEFAULT '🏆', end_date date, created_by integer REFERENCES public.users(id), created_at timestamp DEFAULT now(), is_active boolean DEFAULT true, duration_days integer DEFAULT 7);
    CREATE TABLE IF NOT EXISTS public.challenge_participants (id SERIAL PRIMARY KEY, user_id integer REFERENCES public.users(id) ON DELETE CASCADE, challenge_type character varying(100) NOT NULL, challenge_name character varying(200) NOT NULL, points integer NOT NULL, joined_at timestamp DEFAULT now(), completed boolean DEFAULT false, completed_at timestamp, end_date timestamp, UNIQUE(user_id, challenge_type));
    CREATE TABLE IF NOT EXISTS public.user_points (id SERIAL PRIMARY KEY, user_id integer REFERENCES public.users(id) ON DELETE CASCADE UNIQUE, total_points integer DEFAULT 0, badge character varying(100), updated_at timestamp DEFAULT now());
    CREATE TABLE IF NOT EXISTS public.points_history (id SERIAL PRIMARY KEY, user_id integer REFERENCES public.users(id) ON DELETE CASCADE, points integer NOT NULL, reason character varying(200), challenge_type character varying(100), created_at timestamp DEFAULT now());
    CREATE TABLE IF NOT EXISTS public.leaderboard_stars (user_id integer PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE, stars integer DEFAULT 0);
    CREATE TABLE IF NOT EXISTS public.leaderboard_stars_log (id SERIAL PRIMARY KEY, month integer NOT NULL, year integer NOT NULL, created_at timestamp DEFAULT now(), UNIQUE(month, year));
  `;
  try {
    await pool.query(schema);
    res.json({ message: "✅ All tables created successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
app.use("/api/auth", authRoutes);

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

cron.schedule("0 0 * * *", () => {
  console.log("⏰ Daily cron: checking expired challenges...");
  checkChallenges();
});

cron.schedule("0 * * * *", () => {
  console.log("⏰ Hourly cron: checking end dates...");
  checkChallenges();
});

app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ message: "Database connected successfully", time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Database connection failed" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
