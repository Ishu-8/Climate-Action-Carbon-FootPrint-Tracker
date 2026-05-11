console.log("THIS INDEX FILE IS RUNNING");
require("dotenv").config();

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


app.get("/seed", async (req, res) => {
  try {
    await pool.query(`
      INSERT INTO public.adjustment_factors (id, category, factor_name, multiplier) VALUES
      (1,'peak_hours','peak',1.2),(2,'peak_hours','off_peak',0.9),(3,'season','summer',1.15),
      (4,'season','winter',1.1),(5,'season','normal',1),(6,'traffic','light',1),
      (7,'traffic','moderate',1.1),(8,'traffic','heavy',1.2),(9,'ac','AC_ON',1.05),
      (10,'ac','AC_OFF',1),(11,'vehicle_age','new',1),(12,'vehicle_age','old',1.1),
      (13,'renewable_usage','solar_enabled',0.7),(14,'weather','normal',1),
      (15,'weather','extreme_heat',1.05),(21,'meal_source','local',0.9),
      (22,'meal_source','imported',1.2),(23,'cooking_method','raw',0.8),
      (24,'cooking_method','gas_stove',1),(25,'cooking_method','electric_stove',1.1),
      (26,'cooking_method','microwave',0.95),(27,'organic','organic',0.85),
      (28,'organic','non_organic',1)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.energy_emission_factors (id, energy_source, emission_factor) VALUES
      (1,'Grid Electricity - India',0.82),(2,'Solar',0.05),(3,'Wind',0.02),(4,'Diesel Generator',0.9)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.food_emission_factors (id, meal_type, emission_factor) VALUES
      (1,'Veg Meal',1.5),(2,'Chicken Meal',2.5),(3,'Beef Meal',6),(4,'Milk (1L)',1.2),(5,'Rice (1kg)',2.7)
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.transport_emission_factors (id, vehicle_type, fuel_type, emission_factor) VALUES
      (1,'Car','Petrol',0.13),(2,'Car','Diesel',0.15),(3,'Car','EV',0.02),
      (4,'Bike','Petrol',0.05),(5,'Bus','Diesel',0.08),(6,'Train','Electric',0.04)
      ON CONFLICT (id) DO NOTHING;

      SELECT setval('public.adjustment_factors_id_seq', 28, true);
      SELECT setval('public.energy_emission_factors_id_seq', 4, true);
      SELECT setval('public.food_emission_factors_id_seq', 5, true);
      SELECT setval('public.transport_emission_factors_id_seq', 6, true);
    `);
    res.json({ message: "✅ Seed data inserted successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/create-admin", async (req, res) => {
  try {
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash("ishu@2004", 10);
    await pool.query(`
      INSERT INTO public.users (name, email, password, role)
      VALUES ('Admin', 'ishwarya2082004@gmail.com', $1, 'system_admin')
      ON CONFLICT (email) DO UPDATE SET password = $1, role = 'system_admin'
    `, [hashedPassword]);
    res.json({ message: "✅ Admin created successfully!" });
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
