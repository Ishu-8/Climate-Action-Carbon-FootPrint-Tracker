// migrate.js - Run this once to create all tables in Neon
// Place this in backend/src/ folder
// Run: node src/migrate.js

require("dotenv").config({ path: "../.env" });
const pool = require("./config/db");

const schema = `
CREATE TABLE IF NOT EXISTS public.organizations (
    id SERIAL PRIMARY KEY,
    name character varying(150) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public.departments (
    id SERIAL PRIMARY KEY,
    organization_id integer REFERENCES public.organizations(id),
    name character varying(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    organization_id integer REFERENCES public.organizations(id),
    department_id integer REFERENCES public.departments(id),
    name character varying(100) NOT NULL,
    email character varying(150) NOT NULL UNIQUE,
    role character varying(50) CHECK (role IN ('individual','org_employee','org_admin','system_admin')),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    password character varying(255),
    reset_token character varying(255),
    reset_token_expires timestamp without time zone,
    profile_pic text
);
CREATE TABLE IF NOT EXISTS public.transport_emission_factors (
    id SERIAL PRIMARY KEY,
    vehicle_type character varying(100),
    fuel_type character varying(100),
    emission_factor double precision NOT NULL
);
CREATE TABLE IF NOT EXISTS public.energy_emission_factors (
    id SERIAL PRIMARY KEY,
    energy_source character varying(100),
    emission_factor double precision NOT NULL
);
CREATE TABLE IF NOT EXISTS public.food_emission_factors (
    id SERIAL PRIMARY KEY,
    meal_type character varying(100),
    emission_factor double precision NOT NULL
);
CREATE TABLE IF NOT EXISTS public.adjustment_factors (
    id SERIAL PRIMARY KEY,
    category character varying(50),
    factor_name character varying(100),
    multiplier double precision NOT NULL
);
CREATE TABLE IF NOT EXISTS public.transport_activities (
    id SERIAL PRIMARY KEY,
    user_id integer REFERENCES public.users(id),
    organization_id integer REFERENCES public.organizations(id),
    transport_factor_id integer REFERENCES public.transport_emission_factors(id),
    distance_km double precision NOT NULL,
    employee_count integer,
    traffic_level character varying(20),
    road_type character varying(20),
    ac_used boolean,
    base_factor double precision,
    adjustment_factor double precision,
    calculated_co2 double precision,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    vehicle_age character varying(20),
    weather character varying(20)
);
CREATE TABLE IF NOT EXISTS public.energy_activities (
    id SERIAL PRIMARY KEY,
    user_id integer REFERENCES public.users(id),
    organization_id integer REFERENCES public.organizations(id),
    energy_factor_id integer REFERENCES public.energy_emission_factors(id),
    units_consumed double precision NOT NULL,
    base_factor double precision,
    adjustment_factor double precision,
    calculated_co2 double precision,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    solar_enabled boolean DEFAULT false,
    peak_hours character varying(20),
    season character varying(20)
);
CREATE TABLE IF NOT EXISTS public.food_activities (
    id SERIAL PRIMARY KEY,
    user_id integer REFERENCES public.users(id),
    organization_id integer REFERENCES public.organizations(id),
    food_factor_id integer REFERENCES public.food_emission_factors(id),
    quantity double precision NOT NULL,
    base_factor double precision,
    adjustment_factor double precision,
    calculated_co2 double precision,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    meal_source character varying(20),
    cooking_method character varying(20),
    is_organic boolean DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.policies (
    id SERIAL PRIMARY KEY,
    organization_id integer REFERENCES public.organizations(id),
    policy_name character varying(150),
    impact_factor double precision,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    enabled boolean DEFAULT false,
    description text
);
CREATE TABLE IF NOT EXISTS public.policy_assignments (
    id SERIAL PRIMARY KEY,
    policy_id integer REFERENCES public.policies(id) ON DELETE CASCADE,
    user_id integer REFERENCES public.users(id) ON DELETE CASCADE,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(policy_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.co2_alerts (
    id SERIAL PRIMARY KEY,
    user_id integer REFERENCES public.users(id) ON DELETE CASCADE,
    total_co2 numeric(10,3),
    sent_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    recipient_id integer REFERENCES public.users(id),
    message text,
    is_read boolean DEFAULT false,
    alert_type character varying(50) DEFAULT 'co2_exceeded'
);
CREATE TABLE IF NOT EXISTS public.alerts (
    id SERIAL PRIMARY KEY,
    user_id integer REFERENCES public.users(id),
    organization_id integer REFERENCES public.organizations(id),
    message text,
    alert_type character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public.challenges (
    id SERIAL PRIMARY KEY,
    title character varying(200) NOT NULL,
    description text,
    challenge_type character varying(100) NOT NULL,
    points integer DEFAULT 100 NOT NULL,
    emoji character varying(10) DEFAULT '🏆',
    end_date date,
    created_by integer REFERENCES public.users(id),
    created_at timestamp without time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    duration_days integer DEFAULT 7
);
CREATE TABLE IF NOT EXISTS public.challenge_participants (
    id SERIAL PRIMARY KEY,
    user_id integer REFERENCES public.users(id) ON DELETE CASCADE,
    challenge_type character varying(100) NOT NULL,
    challenge_name character varying(200) NOT NULL,
    points integer NOT NULL,
    joined_at timestamp without time zone DEFAULT now(),
    completed boolean DEFAULT false,
    completed_at timestamp without time zone,
    end_date timestamp without time zone,
    UNIQUE(user_id, challenge_type)
);
CREATE TABLE IF NOT EXISTS public.user_points (
    id SERIAL PRIMARY KEY,
    user_id integer REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    total_points integer DEFAULT 0,
    badge character varying(100),
    updated_at timestamp without time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.points_history (
    id SERIAL PRIMARY KEY,
    user_id integer REFERENCES public.users(id) ON DELETE CASCADE,
    points integer NOT NULL,
    reason character varying(200),
    challenge_type character varying(100),
    created_at timestamp without time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.leaderboard_stars (
    user_id integer PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    stars integer DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.leaderboard_stars_log (
    id SERIAL PRIMARY KEY,
    month integer NOT NULL,
    year integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    UNIQUE(month, year)
);
`;

async function migrate() {
  try {
    console.log("🔄 Running migration...");
    await pool.query(schema);
    console.log("✅ All tables created successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration error:", err.message);
    process.exit(1);
  }
}

migrate();
