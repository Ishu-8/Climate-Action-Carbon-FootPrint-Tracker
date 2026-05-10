import { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import * as API from "./api";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ──────────────────────────────────────────────────────────
// DESIGN TOKENS
// ──────────────────────────────────────────────────────────
const C = {
  bg: "#04100d",
  surface: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.07)",
  borderHover: "rgba(255,255,255,0.14)",
  text: "#e8f5e9",
  muted: "#5d7a65",
  leaf: "#4caf82",
  leafBright: "#6fcf97",
  sky: "#56ccf2",
  amber: "#f2994a",
  rose: "#eb5757",
  violet: "#9b87f5",
  leafDim: "rgba(76,175,130,0.12)",
  leafBorder: "rgba(76,175,130,0.25)",
};

const font = "'Sora', 'DM Sans', system-ui, sans-serif";

// ──────────────────────────────────────────────────────────
// FALLBACK FACTORS (used when backend not yet returning /factors)
// ──────────────────────────────────────────────────────────
const FB_TRANSPORT = [
  { id: 1, vehicle_type: "Car", fuel_type: "Petrol", emission_factor: 0.13 },
  { id: 2, vehicle_type: "Car", fuel_type: "Diesel", emission_factor: 0.15 },
  { id: 3, vehicle_type: "Car", fuel_type: "EV", emission_factor: 0.02 },
  { id: 4, vehicle_type: "Bike", fuel_type: "Petrol", emission_factor: 0.05 },
  { id: 5, vehicle_type: "Bus", fuel_type: "Diesel", emission_factor: 0.08 },
  { id: 6, vehicle_type: "Train", fuel_type: "Electric", emission_factor: 0.04 },
];
const FB_ENERGY = [
  { id: 1, energy_source: "Grid Electricity - India", emission_factor: 0.82 },
  { id: 2, energy_source: "Solar", emission_factor: 0.05 },
  { id: 3, energy_source: "Wind", emission_factor: 0.02 },
  { id: 4, energy_source: "Diesel Generator", emission_factor: 0.9 },
];
const FB_FOOD = [
  { id: 1, meal_type: "Veg Meal", emission_factor: 1.5 },
  { id: 2, meal_type: "Chicken Meal", emission_factor: 2.5 },
  { id: 3, meal_type: "Beef Meal", emission_factor: 6.0 },
  { id: 4, meal_type: "Milk (1L)", emission_factor: 1.2 },
  { id: 5, meal_type: "Rice (1kg)", emission_factor: 2.7 },
];
const FB_ADJ = {
  traffic: { light: 1, moderate: 1.1, heavy: 1.2 },
  ac: { AC_ON: 1.05, AC_OFF: 1.0 },
};

// ──────────────────────────────────────────────────────────
// SHARED SMALL COMPONENTS
// ──────────────────────────────────────────────────────────
function Leaf({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6 2 2 8 2 14c0 4 2.5 7 6 8.5C9 21 10 18 10 18s-1-2 2-4c2-1.5 5-1 7-3 2-2 3-5 3-9C22 2 16 2 12 2z" fill={C.leaf} opacity={0.85} />
    </svg>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ width: 32, height: 32, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.leaf}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );
}

function Toast({ message, type = "success", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: C.leaf, error: C.rose, info: C.sky };
  return (
    <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 9999, background: "#0e1f17", border: `1px solid ${colors[type]}44`, borderRadius: 14, padding: "14px 20px", maxWidth: 360, display: "flex", alignItems: "center", gap: 12, boxShadow: `0 8px 40px ${colors[type]}22`, animation: "slideUp 0.3s ease" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors[type], flexShrink: 0 }} />
      <span style={{ color: C.text, fontSize: 13, flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>✕</button>
    </div>
  );
}

function StatCard({ icon, label, value, unit, accent = C.leaf, sub, loading }) {
  return (
    <div style={{ flex: 1, minWidth: 160, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{icon}</div>
        <span style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</span>
      </div>
      {loading ? (
        <div style={{ height: 36, background: "rgba(255,255,255,0.04)", borderRadius: 8, animation: "pulse 1.5s ease infinite" }} />
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ color: C.text, fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>{value}</span>
          <span style={{ color: C.muted, fontSize: 12 }}>{unit}</span>
        </div>
      )}
      {sub && <div style={{ color: accent, fontSize: 11, marginTop: 5, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ title, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
      <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: -0.3, display: "flex", alignItems: "center", gap: 8 }}>
        <Leaf size={14} /> {title}
      </h3>
      {action}
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: "22px 24px", ...style }}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", loading, style = {} }) {
  const base = { padding: "10px 20px", borderRadius: 10, border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, letterSpacing: 0.3, transition: "all 0.15s", ...style };
  const variants = {
    primary: { background: `linear-gradient(135deg, ${C.leaf}, #2e7d52)`, color: "#fff" },
    ghost: { background: "rgba(255,255,255,0.06)", color: C.text, border: `1px solid ${C.border}` },
    danger: { background: "rgba(235,87,87,0.12)", color: C.rose, border: `1px solid rgba(235,87,87,0.3)` },
  };
  return <button onClick={onClick} disabled={loading} style={{ ...base, ...variants[variant] }}>{loading ? "⏳ Wait..." : children}</button>;
}

const inputStyle = {
  width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 10,
  padding: "10px 13px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: font,
};
const selectStyle = { ...inputStyle, cursor: "pointer" };

// ──────────────────────────────────────────────────────────
// CO₂ GAUGE
// ──────────────────────────────────────────────────────────
function CO2Gauge({ value, max = 20 }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = value < 5 ? "#4caf82" : value < 10 ? "#f2c94c" : value < 15 ? "#f2994a" : "#eb5757";
  const label = value < 5 ? "Excellent" : value < 10 ? "Good" : value < 15 ? "High" : "Critical";
  const circ = 2 * Math.PI * 70;
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", width: 180, height: 180, margin: "0 auto 14px" }}>
        <svg width={180} height={180} viewBox="0 0 180 180" style={{ transform: "rotate(-90deg)" }}>
          <circle cx={90} cy={90} r={70} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={12} />
          <circle cx={90} cy={90} r={70} fill="none" stroke={color} strokeWidth={12}
            strokeDasharray={`${(pct / 100) * circ} ${circ}`} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 10px ${color}88)`, transition: "stroke-dasharray 0.8s ease" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: C.text, fontSize: 34, fontWeight: 900, letterSpacing: -2, transition: "all 0.5s" }}>{value.toFixed(2)}</span>
          <span style={{ color: C.muted, fontSize: 11 }}>kg CO₂</span>
        </div>
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 20, padding: "5px 14px" }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
        <span style={{ color, fontSize: 12, fontWeight: 700 }}>{label}</span>
      </div>
    </div>
  );
}
//----------------------- reset page -------------------------

function ResetPasswordPage({ token }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async () => {
    if (!password || password !== confirm) {
      setError("Passwords don't match!");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
      } else {
        setError(data.message || "Something went wrong");
      }
    } catch {
      setError("Server error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 420, padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔐</div>
          <div style={{ color: C.text, fontSize: 22, fontWeight: 900 }}>Reset Password</div>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>ClimaTrack</div>
        </div>
        <Card>
          {done ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ color: C.leaf, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                Password Reset Successful!
              </div>
              <div style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>
                You can now login with your new password.
              </div>
              <Btn onClick={() => window.location.href = "/"} style={{ width: "100%" }}>
                Go to Login →
              </Btn>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {error && (
                <div style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13, background: "rgba(235,87,87,0.12)", color: C.rose, border: `1px solid rgba(235,87,87,0.3)` }}>
                  {error}
                </div>
              )}
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="New Password"
                type="password"
                style={inputStyle}
              />
              <input
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Confirm New Password"
                type="password"
                style={inputStyle}
              />
              <Btn onClick={handleReset} loading={loading} style={{ width: "100%", marginTop: 6 }}>
                Reset Password →
              </Btn>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}


function LandingPage({ onGetStarted, onSignIn }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #021a0f 0%, #042d18 40%, #05180e 100%)",
      fontFamily: font,
      color: C.text,
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Nature background blobs */}
      <div style={{ position: "fixed", top: "-120px", right: "-120px", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(76,175,130,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "-80px", left: "-80px", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(76,175,130,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", top: "40%", left: "10%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(86,204,242,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", inset: 0, backgroundImage: `radial-gradient(${C.leaf}08 1px, transparent 1px)`, backgroundSize: "32px 32px", pointerEvents: "none" }} />

      {/* ── NAV - முழு width, left corner-ல ── */}
      <nav style={{
        position: "relative", zIndex: 2,
        display: "flex", alignItems: "center",
        padding: "24px 28px 16px 24px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 13,
            background: "linear-gradient(135deg, #4caf82, #1b5e40)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
            boxShadow: "0 0 0 1px rgba(76,175,130,0.3), 0 4px 20px rgba(76,175,130,0.25)",
          }}>🌿</div>
          <div>
            <div style={{ color: "#e8f5e9", fontWeight: 900, fontSize: 18, letterSpacing: -0.5 }}>ClimaTrack</div>
            <div style={{ color: C.leaf, fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>Carbon Footprint Tracker</div>
          </div>
        </div>
      </nav>

      {/* ── BODY CONTENT - center-ல ── */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 980, margin: "0 auto", padding: "0 28px" }}>

        {/* ── HERO ── */}
        <div style={{ textAlign: "center", padding: "40px 0 48px" }}>
          <h1 style={{ color: "#e8f5e9", fontSize: 56, fontWeight: 900, letterSpacing: -2.5, lineHeight: 1.08, margin: "0 0 22px" }}>
            Track Your Carbon.<br />
            <span style={{
              background: "linear-gradient(90deg, #4caf82, #6fcf97, #56ccf2)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>Change Your World.</span>
          </h1>

          <p style={{ color: "#7aab8a", fontSize: 16, lineHeight: 1.75, maxWidth: 500, margin: "0 auto 40px" }}>
            Monitor your CO₂ emissions across transport, energy, and food.
            Join challenges, climb leaderboards, and make a measurable difference for our planet.
          </p>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onGetStarted} style={{
              padding: "13px 34px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #4caf82, #2e7d52)",
              color: "#fff", fontSize: 15, fontWeight: 700,
              cursor: "pointer", fontFamily: font,
              boxShadow: "0 4px 24px rgba(76,175,130,0.4), 0 0 0 1px rgba(76,175,130,0.2)",
            }}>🌱 Get Started Free</button>
            <button onClick={onSignIn} style={{
              padding: "13px 34px", borderRadius: 12,
              border: "1px solid rgba(76,175,130,0.3)",
              background: "rgba(76,175,130,0.06)",
              color: "#b2dfcc", fontSize: 15, fontWeight: 600,
              cursor: "pointer", fontFamily: font,
            }}>Sign In →</button>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 48, justifyContent: "center", marginTop: 56, flexWrap: "wrap" }}>
            {[["850t", "CO₂ Reduced"], ["5+", "Challenges"], ["98%", "Satisfaction"]].map(([num, label]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{
                  background: "linear-gradient(135deg, #4caf82, #6fcf97)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  fontSize: 32, fontWeight: 900, letterSpacing: -1,
                }}>{num}</div>
                <div style={{ color: "#5d7a65", fontSize: 12, marginTop: 5, letterSpacing: 0.5 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FEATURES ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginBottom: 56 }}>
          {[
            { icon: "🚗", title: "Transport Tracking", desc: "Log car, bus and calculate your travel emissions with GPS auto-track.", color: C.sky, glow: "rgba(86,204,242,0.12)" },
            { icon: "⚡", title: "Energy Monitor", desc: "Track home and office energy usage. Solar, grid, diesel — calculated precisely.", color: C.violet, glow: "rgba(155,135,245,0.12)" },
            { icon: "🍽️", title: "Food Footprint", desc: "Understand the climate impact of your daily food choices with detailed tracking.", color: C.amber, glow: "rgba(242,153,74,0.12)" },
            { icon: "🏆", title: "Challenges", desc: "Join org-wide challenges, earn eco points, and climb the global leaderboard.", color: C.leaf, glow: "rgba(76,175,130,0.12)" },
          ].map(({ icon, title, desc, color, glow }) => (
            <div key={title} style={{
              background: `linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))`,
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 18, padding: "24px 20px",
              backdropFilter: "blur(4px)",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = color + "55"; e.currentTarget.style.boxShadow = `0 8px 32px ${glow}`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: `${color}18`,
                border: `1px solid ${color}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, marginBottom: 16,
              }}>{icon}</div>
              <div style={{ color: "#d4edda", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{title}</div>
              <div style={{ color: "#5d7a65", fontSize: 12, lineHeight: 1.7 }}>{desc}</div>
            </div>
          ))}
        </div>

        {/* ── ROLES ── */}
        <div style={{
          background: "linear-gradient(145deg, rgba(76,175,130,0.06), rgba(255,255,255,0.02))",
          border: "1px solid rgba(76,175,130,0.15)",
          borderRadius: 22, padding: "40px 32px", marginBottom: 56, textAlign: "center",
        }}>
          <div style={{ color: C.leaf, fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>Who is it for?</div>
          <div style={{ color: "#d4edda", fontSize: 24, fontWeight: 800, marginBottom: 32, letterSpacing: -0.5 }}>Built for Everyone</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            {[
              { icon: "👤", role: "Individual", desc: "Track your personal carbon footprint daily.", color: C.leaf, border: "rgba(76,175,130,0.25)" },
              { icon: "👷", role: "Org Employee", desc: "Log activities and compete with teammates.", color: C.violet, border: "rgba(155,135,245,0.25)" },
              { icon: "👔", role: "Org Admin", desc: "Manage departments, policies & leaderboards.", color: C.amber, border: "rgba(242,153,74,0.25)" },
              { icon: "⚙️", role: "System Admin", desc: "Oversee all organizations and analytics.", color: C.rose, border: "rgba(235,87,87,0.25)" },
            ].map(({ icon, role, desc, color, border }) => (
              <div key={role} style={{
                background: `${color}0a`,
                border: `1px solid ${border}`,
                borderRadius: 16, padding: "22px 16px",
              }}>
                <div style={{ fontSize: 30, marginBottom: 10 }}>{icon}</div>
                <div style={{ color, fontWeight: 800, fontSize: 13, marginBottom: 6, letterSpacing: 0.2 }}>{role}</div>
                <div style={{ color: "#5d7a65", fontSize: 11, lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <div style={{ textAlign: "center", paddingBottom: 70 }}>
          <div style={{
            display: "inline-block",
            background: "linear-gradient(145deg, rgba(76,175,130,0.08), rgba(76,175,130,0.03))",
            border: "1px solid rgba(76,175,130,0.2)",
            borderRadius: 20, padding: "40px 48px",
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🌍</div>
            <div style={{ color: "#d4edda", fontSize: 22, fontWeight: 900, marginBottom: 10, letterSpacing: -0.5 }}>
              Every Action Counts.  Start Yours Today.
            </div>
            <div style={{ color: "#5d7a65", fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
              Be part of the change — track your CO₂, take on challenges, and help heal our planet. 🌱
            </div>
            <button onClick={onGetStarted} style={{
              padding: "13px 36px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #4caf82, #2e7d52)",
              color: "#fff", fontSize: 15, fontWeight: 700,
              cursor: "pointer", fontFamily: font,
              boxShadow: "0 4px 24px rgba(76,175,130,0.4)",
            }}>Start Tracking Today →</button>
          </div>
        </div>

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        body { background: #021a0f; margin: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(76,175,130,0.25); border-radius: 10px; }
      `}</style>
    </div>
  );
}


// ──────────────────────────────────────────────────────────
// LOGIN / REGISTER PAGE
// ──────────────────────────────────────────────────────────
function AuthPage({ onLogin, onBack })  {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "individual", org_name: "", dept: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [availableDepts, setAvailableDepts] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [deptMode, setDeptMode] = useState("select"); // "select" or "new"
  const [availableOrgs, setAvailableOrgs] = useState([]);

const fetchOrgs = async () => {
  try {
    const res = await fetch("http://localhost:5000/api/auth/organizations");
    const data = await res.json();
    setAvailableOrgs(data.organizations || []);
  } catch {
    setAvailableOrgs([]);
  }
};

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleLogin = async () => {
    if (!form.email || !form.password) { setError("Email and password required"); return; }
    setLoading(true); setError("");
    try {
      const res = await API.authLogin(form.email, form.password);
      API.setToken(res.token);
      // Decode token payload to get user info
      const payload = JSON.parse(atob(res.token.split(".")[1]));
const userData = { 
  id: payload.id, 
  role: payload.role, 
  organization_id: payload.organization_id, 
  email: form.email, 
  name: payload.name || res.name || form.email.split("@")[0]  // ✅ payload.name முதல்ல check
};
      API.setUser(userData);
      onLogin(userData);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!form.name || !form.email || !form.password) { setError("All fields required"); return; }
    setLoading(true); setError("");
    try {
      const payload = { name: form.name, email: form.email, password: form.password, role: form.role };
      if (form.role === "org_employee" || form.role === "org_admin") {
        payload.org_name = form.org_name;
        payload.dept = form.dept;
      }
      await API.authRegister(payload);
      setMode("login");
      setError("✅ Registered! Please login.");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  
  const fetchDepartments = async (orgName) => {
  if (!orgName || orgName.length < 2) {
    setAvailableDepts([]);
    return;
  }
  setLoadingDepts(true);
  try {
    const res = await fetch(`http://localhost:5000/api/auth/departments?org_name=${encodeURIComponent(orgName)}`);
    const data = await res.json();
    setAvailableDepts(data.departments || []);
    setDeptMode(data.departments?.length > 0 ? "select" : "new");
  } catch {
    setAvailableDepts([]);
  } finally {
    setLoadingDepts(false);
  }
};

  return (

    
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
      
      <div onClick={onBack} style={{
  position: "fixed", top: 20, left: 24, zIndex: 100,
  display: "flex", alignItems: "center", gap: 6,
  cursor: "pointer", color: C.leaf,
  fontSize: 13, fontWeight: 700,
}}>
  ← Back
</div>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
        {[...Array(18)].map((_, i) => (
          <div key={i} style={{
            position: "absolute", borderRadius: "50%",
            left: `${(i * 37 + 11) % 100}%`, top: `${(i * 53 + 7) % 100}%`,
            width: 2 + (i % 4), height: 2 + (i % 4),
            background: C.leaf, opacity: 0.08 + (i % 5) * 0.03,
          }} />
        ))}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 300, background: `linear-gradient(0deg, ${C.leafDim} 0%, transparent 100%)` }} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 200, background: `linear-gradient(180deg, rgba(4,16,13,0.8) 0%, transparent 100%)` }} />
      </div>

      <div style={{ width: "100%", maxWidth: 460, padding: "0 20px", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${C.leaf}, #1b5e40)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: `0 0 32px ${C.leaf}44` }}>
              🌿
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ color: C.text, fontSize: 22, fontWeight: 900, letterSpacing: -0.8 }}>ClimaTrack</div>
              <div style={{ color: C.leaf, fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" }}>Carbon Footprint Tracker</div>
            </div>
          </div>
          <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Track • Reduce • Restore</p>
        </div>

        <Card>
          {/* Mode toggle — login / register மட்டும் */}
         <div className="mode-toggle" style={{ display: mode === "forgot" ? "none" : "flex", background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 3, marginBottom: 24 }}>
            {["login", "register"].map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(""); }}
                style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, transition: "all 0.2s", textTransform: "capitalize",
                  background: mode === m ? `${C.leaf}22` : "transparent",
                  color: mode === m ? C.leaf : C.muted }}>
                {m === "login" ? "🔐 Sign In" : "🌱 Register"}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13,
              background: error.startsWith("✅") ? `${C.leaf}18` : "rgba(235,87,87,0.12)",
              color: error.startsWith("✅") ? C.leaf : C.rose,
              border: `1px solid ${error.startsWith("✅") ? C.leaf : C.rose}44` }}>
              {error}
            </div>
          )}
          
          {/* ── FORGOT PASSWORD MODE ── */}
{mode === "forgot" && (
  <div>
    {/* Mode toggle hide பண்ணு */}
    <style>{`.mode-toggle { display: none; }`}</style>

    <div style={{ textAlign: "center", marginBottom: 20 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
      <div style={{ color: C.text, fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Reset Password</div>
      <div style={{ color: C.muted, fontSize: 12 }}>Enter your email — we'll send a reset link</div>
    </div>

    {forgotSent ? (
      <div style={{ padding: "12px 16px", background: `${C.leaf}18`, border: `1px solid ${C.leaf}44`, borderRadius: 10, color: C.leaf, fontSize: 13, textAlign: "center" }}>
        ✅ Reset link sent! Check your email.
      </div>
    ) : (
      <>
        <input value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
          placeholder="Email address" type="email" style={inputStyle} />
        <div style={{ position: "relative", marginTop: 12 }}>
          <Btn onClick={async () => {
            if (!forgotEmail) return;
            setLoading(true);
            try {
              await fetch("http://localhost:5000/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: forgotEmail })
              });
              setForgotSent(true);
            } catch {
              setError("Something went wrong. Try again.");
            } finally { setLoading(false); }
          }} loading={loading} style={{ width: "100%", marginTop: 12 }}>
          Send Reset Link →
        </Btn>
          <div style={{ textAlign: "right", marginTop: 10 }}>
          <button onClick={() => setMode("login")}
            style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
            ← Back to Sign In
          </button>
        </div>
        </div>
      </>
    )}
  </div>
)}
          {/* ── LOGIN / REGISTER MODE ── */}
          {mode !== "forgot" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {mode === "register" && (
                <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Full Name" style={inputStyle} />
              )}

              <input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="Email address" type="email" style={inputStyle} />

              <div style={{ position: "relative" }}>
                <input value={form.password} onChange={e => set("password", e.target.value)}
                  placeholder="Password" type={showPassword ? "text" : "password"}
                  style={{ ...inputStyle, paddingRight: 40 }} />
                <button onClick={() => setShowPassword(p => !p)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 16, padding: 0 }}>
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>

              {mode === "register" && (
                <>
                  <select value={form.role} onChange={e => {
                    set("role", e.target.value);
                    set("org_name", "");
                    set("dept", "");
                    setAvailableDepts([]);
                    setAvailableOrgs([]);
                  }} style={selectStyle}>
                    <option value="individual">👤 Individual User</option>
                    <option value="org_employee">👷 Organization Employee</option>
                    <option value="org_admin">👔 Organization Admin</option>
                  </select>

                  {form.role === "org_admin" && (
                    <input value={form.org_name} onChange={e => set("org_name", e.target.value)}
                      placeholder="Organization Name" style={inputStyle} />
                  )}

                  {form.role === "org_employee" && (
                    <>
                      <select value={form.org_name} onChange={e => {
                        set("org_name", e.target.value);
                        set("dept", "");
                        fetchDepartments(e.target.value);
                      }} onFocus={fetchOrgs} style={selectStyle}>
                        <option value="">— Select Organization —</option>
                        {availableOrgs.map((o, i) => (
                          <option key={i} value={o.name}>{o.name}</option>
                        ))}
                      </select>

                      {loadingDepts ? (
                        <div style={{ color: C.muted, fontSize: 12, padding: "8px 13px" }}>Loading departments...</div>
                      ) : availableDepts.length > 0 ? (
                        <>
                          <select value={deptMode === "select" ? form.dept : "__new__"}
                            onChange={e => {
                              if (e.target.value === "__new__") { setDeptMode("new"); set("dept", ""); }
                              else { setDeptMode("select"); set("dept", e.target.value); }
                            }} style={selectStyle}>
                            <option value="">— Select Department —</option>
                            {availableDepts.map((d, i) => (
                              <option key={i} value={d.name}>{d.name}</option>
                            ))}
                            <option value="__new__">➕ Add new department</option>
                          </select>
                          {deptMode === "new" && (
                            <input value={form.dept} onChange={e => set("dept", e.target.value)}
                              placeholder="New department name" style={inputStyle} />
                          )}
                        </>
                      ) : form.org_name ? (
                        <input value={form.dept} onChange={e => set("dept", e.target.value)}
                          placeholder="Department name" style={inputStyle} />
                      ) : null}
                    </>
                  )}
                </>
              )}

              <Btn onClick={mode === "login" ? handleLogin : handleRegister} loading={loading} style={{ marginTop: 6 }}>
                {mode === "login" ? "Sign In →" : "Create Account →"}
              </Btn>

              {mode === "login" && (
                <div style={{ textAlign: "center", marginTop: 8 }}>
                  <button onClick={() => setMode("forgot")}
                    style={{ background: "none", border: "none", color: C.leaf, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                    Forgot Password?
                  </button>
                </div>
              )}
            </div>
          )}

        </Card>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes slideUp { from { transform:translateY(20px);opacity:0 } to { transform:translateY(0);opacity:1 } }
        * { box-sizing: border-box; }
        select option { background: #0e1f17; color: #e8f5e9; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(76,175,130,0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
}
// ──────────────────────────────────────────────────────────
// SIDEBAR
// ──────────────────────────────────────────────────────────
function Sidebar({ user, onLogout, activeTab, setActiveTab }) {
  const navMap = {
    individual: [
      { id: "overview", icon: "🌍", label: "Dashboard" },
      { id: "log", icon: "➕", label: "Log Activity" },
      { id: "history", icon: "📈", label: "History" },
      { id: "challenges", icon: "🏆", label: "Challenges" },
      { id: "global-leaderboard", label: "Leaderboard", icon: "🏆" },
      { id: "profile", label: "Profile", icon: "👤" },
      { id: "reports", label: "Reports", icon: "📄" },
      
    ],
    org_employee: [
      { id: "overview", icon: "🌿", label: "My Dashboard" },
      { id: "log", icon: "➕", label: "Log Activity" },
      { id: "leaderboard", icon: "🏆", label: "Leaderboard" },
      { id: "history", icon: "📈", label: "History" },
      { id: "policies", label: "Policies", icon: "📋" },
      { id: "challenges", label: "Challenges", icon: "🏆" },
      { id: "global-leaderboard", label: "Global Leaderboard", icon: "🏆" },
      { id: "profile", label: "Profile", icon: "👤" },
      { id: "reports", label: "Reports", icon: "📄" },
    ],
    org_admin: [
      { id: "overview", icon: "🏢", label: "Org Overview" },
      { id: "departments", icon: "📊", label: "Departments" },
      { id: "employees", icon: "👥", label: "Employees" },
      { id: "policies", icon: "📋", label: "Policies" },
      { id: "challenges", label: "Challenges", icon: "🏆" },
      { id: "global-leaderboard", label: "Leaderboard", icon: "🏆" },
      { id: "profile", label: "Profile", icon: "👤" },
      { id: "reports", label: "Reports", icon: "📄" },
    ],
    system_admin: [
      { id: "overview", icon: "🌐", label: "System Overview" },
      { id: "users", icon: "👥", label: "All Users" },
      { id: "organizations", icon: "🏢", label: "Organizations" },
      { id: "challenges", icon: "🏆", label: "Challenges" },
      { id: "global-leaderboard", label: "Leaderboard", icon: "🏆" },
      { id: "profile", label: "Profile", icon: "👤" },
      { id: "reports", label: "Reports", icon: "📄" },
    ],
  };

  const roleColors = { individual: C.leaf, org_employee: C.violet, org_admin: C.amber, system_admin: C.rose };
  const roleLabels = { individual: "Individual", org_employee: "Org Employee", org_admin: "Org Admin", system_admin: "System Admin" };
  const rc = roleColors[user.role] || C.leaf;
  const navItems = navMap[user.role] || navMap.individual;

  return (
    <div style={{ width: 220, background: "rgba(4,10,8,0.95)", borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", padding: "22px 14px", flexShrink: 0, height: "100vh", overflow: "hidden" }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 28 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${C.leaf}, #1b5e40)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🌿</div>
        <div>
          <div style={{ color: C.text, fontWeight: 900, fontSize: 15, letterSpacing: -0.5 }}>ClimaTrack</div>
          <div style={{ color: C.leaf, fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>CO₂ Tracker</div>
        </div>
      </div>

      {/* User card */}
      <div style={{ background: `${rc}0e`, border: `1px solid ${rc}25`, borderRadius: 12, padding: "12px 14px", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${rc}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
           {user.profile_pic ? (
  <img src={user.profile_pic} alt="Profile"
    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
) : (
  user.role === "individual" ? "👤" : user.role === "org_employee" ? "👷" : user.role === "org_admin" ? "👔" : "⚙️"
)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name || user.email}</div>
            <div style={{ color: rc, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>{roleLabels[user.role]}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: active ? 700 : 500, width: "100%", textAlign: "left", transition: "all 0.15s",
                background: active ? `${rc}18` : "transparent",
                color: active ? rc : C.muted }}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, marginTop: 14 }}>
        <button onClick={onLogout}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, border: "none", cursor: "pointer", background: "rgba(235,87,87,0.08)", color: C.rose, fontSize: 12, fontWeight: 600, width: "100%" }}>
          🚪 Sign Out
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// ENVIRONMENTAL BANNER (real AQI + weather via backend)
// ──────────────────────────────────────────────────────────
function EnvBanner({ city }) {
  const [env, setEnv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detectedCity, setDetectedCity] = useState(city || "Chennai");


  useEffect(() => {
    // GPS location detect பண்ணி city கண்டுபிடி
    if (!city && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
            );
            const data = await res.json();
            const cityName = data.address?.city || 
                           data.address?.town || 
                           data.address?.village || 
                           data.address?.county || 
                           "Chennai";
            setDetectedCity(cityName);
          } catch {
            setDetectedCity("Chennai");
          }
        },
        () => setDetectedCity("Chennai")
      );
    }
  }, [city]);

  useEffect(() => {
    let alive = true;
    const loadEnv = async () => {
      try {
        const data = await API.getEnvironmentalData(detectedCity);
        if (alive) setEnv(data);
      } catch {
        if (alive) setEnv({ aqi: "–", level: "N/A", temp: "–", humidity: "–", suggestion: "Connect backend to enable real-time environmental data." });
      } finally { if (alive) setLoading(false); }
    };
    loadEnv();
    const interval = setInterval(loadEnv, 5 * 60 * 1000);
    return () => { alive = false; clearInterval(interval); };
  }, [detectedCity]);

  const aqiColor = env?.aqi > 150 ? C.rose : env?.aqi > 100 ? C.amber : C.leaf;

  return (
    <div style={{ background: `linear-gradient(90deg, ${C.leafDim}, rgba(86,204,242,0.06))`, border: `1px solid ${C.leafBorder}`, borderRadius: 14, padding: "13px 20px", marginBottom: 22, display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ fontSize: 26 }}>🌤️</div>
      {loading ? (
        <div style={{ color: C.muted, fontSize: 13 }}>Loading environmental data...</div>
      ) : (
        <>
          <div style={{ flex: 1 }}>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{detectedCity} — Live Environment</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>
              AQI: <b style={{ color: aqiColor }}>{env?.aqi}</b>{env?.level && ` (${env.level})`}
              {env?.temp && ` · 🌡️ ${env.temp}`}
              {env?.humidity && ` · 💧 ${env.humidity}`}
            </div>
          </div>
          {env?.suggestion && (
            <div style={{ color: C.muted, fontSize: 12, maxWidth: 280, lineHeight: 1.5, borderLeft: `2px solid ${C.leafBorder}`, paddingLeft: 12 }}>{env.suggestion}</div>
          )}
        </>
      )}
    </div>
  );
}
// ──────────────────────────────────────────────────────────
// GPS TRIP TRACKER
// ──────────────────────────────────────────────────────────
function GPSTracker({ onTripComplete }) {
  const [tracking, setTracking] = useState(false);
  const [distance, setDistance] = useState(0);
  const [status, setStatus] = useState("idle");
  const watchIdRef = useRef(null);
  const lastPosRef = useRef(null);
  const accDistRef = useRef(0);

  const startTracking = () => {
    setStatus("requesting");
    watchIdRef.current = API.watchLocation(
      (pos) => {
        setStatus("tracking");
        setTracking(true);
        if (lastPosRef.current) {
          const d = API.haversineKm(lastPosRef.current.lat, lastPosRef.current.lng, pos.lat, pos.lng);
          if (d < 2) { // ignore GPS jumps > 2km
            accDistRef.current += d;
            setDistance(+accDistRef.current.toFixed(3));
          }
        }
        lastPosRef.current = pos;
      },
      (err) => { setStatus("error"); setTracking(false); }
    );
  };

  const stopTracking = () => {
    API.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setTracking(false);
    setStatus("done");
    if (accDistRef.current > 0) onTripComplete(+accDistRef.current.toFixed(3));
  };

  const reset = () => { setDistance(0); accDistRef.current = 0; lastPosRef.current = null; setStatus("idle"); };

  return (
    <div style={{ background: tracking ? `${C.leaf}0a` : "rgba(255,255,255,0.03)", border: `1px solid ${tracking ? C.leaf + "44" : C.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16, transition: "all 0.3s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 22 }}>📍</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>GPS Auto-Track</div>
          <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
            {status === "idle" && "Enable GPS to auto-calculate trip distance"}
            {status === "requesting" && "Requesting GPS permission..."}
            {status === "tracking" && `🟢 Live: ${distance.toFixed(3)} km tracked`}
            {status === "done" && `Trip complete: ${distance.toFixed(3)} km — applied to form below`}
            {status === "error" && "GPS unavailable. Enter distance manually."}
          </div>
        </div>
        {tracking ? (
          <Btn onClick={stopTracking} variant="danger" style={{ padding: "7px 14px", fontSize: 12 }}>⏹ Stop</Btn>
        ) : (
          <Btn onClick={startTracking} style={{ padding: "7px 14px", fontSize: 12 }} variant="ghost">▶ Start GPS</Btn>
        )}
        {status === "done" && <button onClick={reset} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12 }}>Reset</button>}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// ACTIVITY LOG FORM
// ──────────────────────────────────────────────────────────
function ActivityLogForm({ onLogged, toast }) {
  const [type, setType] = useState("transport");
  const [factors, setFactors] = useState({ transport: FB_TRANSPORT, energy: FB_ENERGY, food: FB_FOOD, adj: FB_ADJ });
  const [form, setForm] = useState({ transport_factor_id: 1, distance_km: "", traffic_level: "moderate", ac_used: false, energy_factor_id: 1, units_consumed: "", food_factor_id: 1, quantity: 1 });
  const [preview, setPreview] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load real factors from backend
  useEffect(() => {
    Promise.allSettled([
      API.getTransportFactors(),
      API.getEnergyFactors(),
      API.getFoodFactors(),
      API.getAdjustmentFactors(),
    ]).then(([t, e, f, a]) => {
      setFactors({
        transport: t.status === "fulfilled" ? t.value : FB_TRANSPORT,
        energy: e.status === "fulfilled" ? e.value : FB_ENERGY,
        food: f.status === "fulfilled" ? f.value : FB_FOOD,
        adj: a.status === "fulfilled" ? a.value : FB_ADJ,
      });
    });
  }, []);

  // Real-time preview calculation
  useEffect(() => {
    if (type === "transport") {
      const f = factors.transport.find(x => x.id === +form.transport_factor_id);
      if (!f || !form.distance_km) { setPreview(0); return; }
      const trafficMult = factors.adj?.traffic?.[form.traffic_level] || 1;
      const acMult = form.ac_used ? (factors.adj?.ac?.AC_ON || 1.05) : 1;
      setPreview(API.calcTransportCO2(+form.distance_km, f.emission_factor, trafficMult, acMult));
    } else if (type === "energy") {
      const f = factors.energy.find(x => x.id === +form.energy_factor_id);
      if (!f || !form.units_consumed) { setPreview(0); return; }
      setPreview(API.calcEnergyCO2(+form.units_consumed, f.emission_factor));
    } else {
      const f = factors.food.find(x => x.id === +form.food_factor_id);
      if (!f) { setPreview(0); return; }
      setPreview(API.calcFoodCO2(+form.quantity, f.emission_factor));
    }
  }, [form, type, factors]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    setLoading(true);
    try {
      let res;
      if (type === "transport") {
        if (!form.distance_km) throw new Error("Enter distance");
       res = await API.addTransport({ transport_factor_id: +form.transport_factor_id, distance_km: +form.distance_km, traffic_level: form.traffic_level, ac_used: form.ac_used, vehicle_age: form.vehicle_age || null, weather: form.weather || null });
      } else if (type === "energy") {
        if (!form.units_consumed) throw new Error("Enter units consumed");
       res = await API.addEnergy({ energy_factor_id: +form.energy_factor_id, units_consumed: +form.units_consumed, solar_enabled: form.solar_enabled || false, peak_hours: form.peak_hours || null, season: form.season || null });
      } else {
        res = await API.addFood({ food_factor_id: +form.food_factor_id, quantity: +form.quantity, meal_source: form.meal_source || null, cooking_method: form.cooking_method || null, is_organic: form.is_organic || false });
      }
      toast(`✅ Logged! ${res.co2?.toFixed(3) || preview} kg CO₂ calculated`);
      onLogged({ type, co2: res.co2 || preview });
      setForm(p => ({ ...p, distance_km: "", units_consumed: "", quantity: 1 }));
    } catch (e) { toast(e.message, "error"); }
    finally { setLoading(false); }
  };

  return (
    <div>
      {/* Type selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[["transport", "🚗", "Transport"], ["energy", "⚡", "Energy"], ["food", "🍽️", "Food"]].map(([t, icon, label]) => (
          <button key={t} onClick={() => setType(t)}
            style={{ flex: 1, padding: "9px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, transition: "all 0.2s",
              background: type === t ? `${C.leaf}20` : "rgba(255,255,255,0.05)",
              color: type === t ? C.leaf : C.muted }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {type === "transport" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <GPSTracker onTripComplete={(km) => set("distance_km", km)} />
          <select value={form.transport_factor_id} onChange={e => set("transport_factor_id", +e.target.value)} style={selectStyle}>
            {factors.transport.map(f => <option key={f.id} value={f.id}>{f.vehicle_type} — {f.fuel_type} ({f.emission_factor} kg/km)</option>)}
          </select>
          <input type="number" value={form.distance_km} onChange={e => set("distance_km", e.target.value)} placeholder="Distance (km)" min="0" style={inputStyle} />
          <select value={form.traffic_level} onChange={e => set("traffic_level", e.target.value)} style={selectStyle}>
            <option value="light">🟢 Traffic: Light (×1.0)</option>
            <option value="moderate">🟡 Traffic: Moderate (×1.1)</option>
            <option value="heavy">🔴 Traffic: Heavy (×1.2)</option>
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 10, color: C.muted, fontSize: 13, cursor: "pointer", padding: "8px 0" }}>
            <input type="checkbox" checked={form.ac_used} onChange={e => set("ac_used", e.target.checked)} style={{ width: 16, height: 16, accentColor: C.leaf }} />
            AC Used (×1.05 multiplier)
          </label>
          {/* Vehicle Age */}
<div>
  <label style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, display: "block" }}>🚗 Vehicle Age</label>
  <select value={form.vehicle_age || ""} onChange={e => set("vehicle_age", e.target.value)} style={selectStyle}>
    <option value="">Select vehicle age</option>
    <option value="new">New (×1.0)</option>
    <option value="old">Old (×1.1)</option>
  </select>
</div>

{/* Weather */}
<div>
  <label style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, display: "block" }}>🌤️ Weather Condition</label>
  <select value={form.weather || ""} onChange={e => set("weather", e.target.value)} style={selectStyle}>
    <option value="">Select weather</option>
    <option value="normal">Normal (×1.0)</option>
    <option value="extreme_heat">Extreme Heat (×1.05)</option>
  </select>
</div>
        </div>
      )}

      {type === "energy" && (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <select value={form.energy_factor_id} onChange={e => set("energy_factor_id", +e.target.value)} style={selectStyle}>
      {factors.energy.map(f => <option key={f.id} value={f.id}>{f.energy_source} ({f.emission_factor} kg/kWh)</option>)}
    </select>
    <input type="number" value={form.units_consumed} onChange={e => set("units_consumed", e.target.value)} placeholder="Units consumed (kWh)" min="0" style={inputStyle} />

    {/* Solar */}
    <label style={{ display: "flex", alignItems: "center", gap: 10, color: C.muted, fontSize: 13, cursor: "pointer", padding: "8px 0" }}>
      <input type="checkbox" checked={form.solar_enabled || false} onChange={e => set("solar_enabled", e.target.checked)} style={{ width: 16, height: 16, accentColor: C.leaf }} />
      ☀️ Solar Panels Enabled (×0.7 — 30% reduction)
    </label>

    {/* Peak Hours */}
    <div>
      <label style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, display: "block" }}>⚡ Usage Time</label>
      <select value={form.peak_hours || ""} onChange={e => set("peak_hours", e.target.value)} style={selectStyle}>
        <option value="">Select usage time</option>
        <option value="peak">Peak Hours 6PM-10PM (×1.2)</option>
        <option value="off_peak">Off-Peak Hours (×0.9)</option>
      </select>
    </div>

    {/* Season */}
    <div>
      <label style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, display: "block" }}>🌡️ Season</label>
      <select value={form.season || ""} onChange={e => set("season", e.target.value)} style={selectStyle}>
        <option value="">Select season</option>
        <option value="normal">Normal (×1.0)</option>
        <option value="summer">Summer (×1.15)</option>
        <option value="winter">Winter (×1.1)</option>
      </select>
    </div>
  </div>
)}

     {type === "food" && (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <select value={form.food_factor_id} onChange={e => set("food_factor_id", +e.target.value)} style={selectStyle}>
      {factors.food.map(f => <option key={f.id} value={f.id}>{f.meal_type} ({f.emission_factor} kg CO₂/unit)</option>)}
    </select>
    <input type="number" value={form.quantity} onChange={e => set("quantity", e.target.value)} placeholder="Quantity / servings" min="1" style={inputStyle} />

    {/* Meal Source */}
    <div>
      <label style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, display: "block" }}>🌍 Meal Source</label>
      <select value={form.meal_source || ""} onChange={e => set("meal_source", e.target.value)} style={selectStyle}>
        <option value="">Select meal source</option>
        <option value="local">Local (×0.9 — 10% reduction)</option>
        <option value="imported">Imported (×1.2 — 20% increase)</option>
      </select>
    </div>

    {/* Cooking Method */}
    <div>
      <label style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, display: "block" }}>🍳 Cooking Method</label>
      <select value={form.cooking_method || ""} onChange={e => set("cooking_method", e.target.value)} style={selectStyle}>
        <option value="">Select cooking method</option>
        <option value="raw">Raw / No cooking (×0.8)</option>
        <option value="gas_stove">Gas Stove (×1.0)</option>
        <option value="electric_stove">Electric Stove (×1.1)</option>
        <option value="microwave">Microwave (×0.95)</option>
      </select>
    </div>

    {/* Organic */}
    <label style={{ display: "flex", alignItems: "center", gap: 10, color: C.muted, fontSize: 13, cursor: "pointer", padding: "8px 0" }}>
      <input type="checkbox" checked={form.is_organic || false} onChange={e => set("is_organic", e.target.checked)} style={{ width: 16, height: 16, accentColor: C.leaf }} />
      🌱 Organic Food (×0.85 — 15% reduction)
    </label>
  </div>
)}
      {/* Live preview */}
      <div style={{ margin: "14px 0", padding: "13px 16px", background: `${C.leaf}0a`, border: `1px solid ${C.leafBorder}`, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: C.muted, fontSize: 12 }}>⚡ Live CO₂ Preview</span>
        <span style={{ color: C.leaf, fontWeight: 900, fontSize: 22, letterSpacing: -1 }}>{preview.toFixed(3)} kg</span>
      </div>

      <Btn onClick={submit} loading={loading} style={{ width: "100%" }}>
        ➕ Log Activity to Database
      </Btn>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// INDIVIDUAL DASHBOARD
// ──────────────────────────────────────────────────────────
function IndividualDashboard({ user, tab, toast, onProfileUpdate }) {
  const [summary, setSummary] = useState(null);
  const [period, setPeriod] = useState("daily");
  const [history, setHistory] = useState([]);
  const [loadingSum, setLoadingSum] = useState(true);
  const [loadingHist, setLoadingHist] = useState(true);
  const [tick, setTick] = useState(0); // force refresh after log

  const [myChallenges, setMyChallenges] = useState([]);
  const [myPoints, setMyPoints] = useState({ total_points: 0, badge: null });
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [dbChallenges, setDbChallenges] = useState([]);

  const refreshSummary = useCallback(async () => {
    setLoadingSum(true);
    try {
      const data = await API.getUserSummary(user.id, period);
      setSummary(data);
    } catch (e) { /* backend not ready yet */ }
    finally { setLoadingSum(false); }
  }, [user.id, period]);

  useEffect(() => { refreshSummary(); }, [refreshSummary, tick]);

// ✅ முதல்ல define பண்ணு
const fetchChallenges = async () => {
  try {
    const [ch, pts] = await Promise.all([
      API.getMyChallenges(),
      API.getMyPoints()
    ]);
    setMyChallenges(ch.challenges || []);
    setMyPoints(pts.points || { total_points: 0, badge: null });
  } catch (err) {
    console.error(err);
  }
};

// ✅ பிறகு useEffects
useEffect(() => {
  fetchChallenges();
}, []);

useEffect(() => {
  const load = async () => {
    try {
      const res = await API.getAllChallenges();
      setDbChallenges(res.challenges || []);
    } catch (err) { console.error(err); }
  };
  load();
}, []);
  useEffect(() => {
    const loadHistory = async () => {
      setLoadingHist(true);
      try {
        const [t, e, f] = await Promise.allSettled([API.getTransport(), API.getEnergy(), API.getFood()]);
        const records = [];
        if (t.status === "fulfilled") t.value.records?.forEach(r => records.push({ ...r, category: "transport" }));
        if (e.status === "fulfilled") e.value.records?.forEach(r => records.push({ ...r, category: "energy" }));
        if (f.status === "fulfilled") f.value.records?.forEach(r => records.push({ ...r, category: "food" }));
        records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setHistory(records.slice(0, 30));
      } catch { }
      finally { setLoadingHist(false); }
    };
    if (tab === "history") loadHistory();
  }, [tab, tick]);

  const total = summary?.grand_total || 0;
  const categories = summary?.categories || [];
  const pieData = categories.map((c, i) => ({ ...c, color: [C.leaf, C.violet, C.amber][i] }));

  const suggestions = [];
  if (summary) {
    const t = categories.find(c => c.name === "Transport");
    const f = categories.find(c => c.name === "Food");
    if (t?.percentage > 50) suggestions.push("🚌 Transport is your biggest source. Try public transit or carpooling.");
    if (f?.percentage > 40) suggestions.push("🥦 Food emissions are high. Consider more plant-based meals.");
    if (total > 10) suggestions.push("⚠️ Today's CO₂ is above recommended daily limit (8 kg).");
    if (total < 5) suggestions.push("🌟 Excellent! You're well below the daily CO₂ target.");
    suggestions.push("🌲 Offset tip: Plant 1 tree per 22 kg CO₂ emitted.");
  }

  if (tab === "overview") return (
    <div>
      <EnvBanner />

      {/* Period selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "rgba(255,255,255,0.03)", padding: 3, borderRadius: 10, width: "fit-content" }}>
        {["daily", "monthly", "yearly"].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{ padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, textTransform: "capitalize", transition: "all 0.2s",
              background: period === p ? `${C.leaf}20` : "transparent",
              color: period === p ? C.leaf : C.muted }}>
            {p}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
        <StatCard icon="🌍" label="Total CO₂" value={loadingSum ? "..." : total.toFixed(2)} unit="kg" accent={C.leaf} loading={loadingSum} />
        <StatCard icon="🚗" label="Transport" value={loadingSum ? "..." : (categories.find(c => c.name === "Transport")?.total || 0).toFixed(2)} unit="kg" accent={C.sky} loading={loadingSum} />
        <StatCard icon="⚡" label="Energy" value={loadingSum ? "..." : (categories.find(c => c.name === "Energy")?.total || 0).toFixed(2)} unit="kg" accent={C.violet} loading={loadingSum} />
        <StatCard icon="🍽️" label="Food" value={loadingSum ? "..." : (categories.find(c => c.name === "Food")?.total || 0).toFixed(2)} unit="kg" accent={C.amber} loading={loadingSum} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "210px 1fr 300px", gap: 18 }}>
        <Card>
          <SectionTitle title="CO₂ Gauge" />
          <CO2Gauge value={loadingSum ? 0 : total} />
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {pieData.map(d => (
              <div key={d.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                  <span style={{ color: C.muted, fontSize: 12 }}>{d.name}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{d.total?.toFixed(2)}</span>
                  <span style={{ color: C.muted, fontSize: 11 }}>({d.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title="CO₂ Breakdown" />
          {!loadingSum && categories.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="total" nameKey="name" paddingAngle={3}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0e1f17", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} formatter={(v) => [`${v.toFixed(3)} kg`, ""]} />
                <Legend wrapperStyle={{ color: C.muted, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Spinner />}
        </Card>

        <Card>
          <SectionTitle title="🧠 Smart Suggestions" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loadingSum ? <Spinner /> : suggestions.length > 0 ? suggestions.map((s, i) => (
              <div key={i} style={{ background: `${C.leaf}08`, border: `1px solid ${C.leafBorder}`, borderRadius: 10, padding: "11px 13px", fontSize: 12, color: "#b2dfcc", lineHeight: 1.6 }}>{s}</div>
            )) : <div style={{ color: C.muted, fontSize: 13 }}>Log some activities to see suggestions.</div>}
          </div>
        </Card>
      </div>
    </div>
  );

  if (tab === "log") return (
    <div style={{ maxWidth: 680 }}>
      <Card>
        <SectionTitle title="Log Activity" />
        <ActivityLogForm onLogged={() => setTick(t => t + 1)} toast={toast} />
      </Card>
    </div>
  );

  if (tab === "history") return (
  <div>
    {loadingHist ? <Spinner /> : history.length === 0 ? (
      <Card>
        <div style={{ color: C.muted, textAlign: "center", padding: 40, fontSize: 14 }}>
          No activities logged yet. Start tracking! 🌱
        </div>
      </Card>
    ) : (() => {
      // ── Date-wise grouping ──────────────────────
      const grouped = {};
      history.forEach(r => {
        const dateKey = new Date(r.created_at).toLocaleDateString("en-IN", {
          weekday: "long", year: "numeric",
          month: "long", day: "numeric"
        });
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(r);
      });

      const catIcons = { transport: "🚗", energy: "⚡", food: "🍽️" };
      const catColors = { transport: C.sky, energy: C.violet, food: C.amber };
      const catLabels = { transport: "Transport", energy: "Energy", food: "Food" };

      return Object.entries(grouped).map(([date, records], gi) => {
        // Daily total
        const dayTotal = records.reduce((sum, r) =>
          sum + parseFloat(r.calculated_co2 || 0), 0);

        const dayColor = dayTotal < 5 ? C.leaf :
                         dayTotal < 10 ? C.amber : C.rose;

        return (
          <Card key={gi} style={{ marginBottom: 14 }}>
            {/* Date Header */}
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 14,
              paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10,
                  background: `${C.leaf}15`, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 16 }}>📅</div>
                <div>
                  <div style={{ color: C.text, fontWeight: 800,
                    fontSize: 14 }}>{date}</div>
                  <div style={{ color: C.muted, fontSize: 11,
                    marginTop: 2 }}>{records.length} activities logged</div>
                </div>
              </div>
              {/* Day Total */}
              <div style={{ textAlign: "right" }}>
                <div style={{ color: dayColor, fontSize: 20,
                  fontWeight: 900, letterSpacing: -1 }}>
                  {dayTotal.toFixed(3)} kg
                </div>
                <div style={{ color: C.muted, fontSize: 10,
                  marginTop: 1 }}>Day Total CO₂</div>
              </div>
            </div>

            {/* Activity Rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {records.map((r, ri) => (
                <div key={ri} style={{ display: "flex", alignItems: "center",
                  gap: 12, padding: "10px 14px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 10,
                  border: `1px solid ${C.border}` }}>

                  {/* Icon */}
                  <div style={{ width: 32, height: 32, borderRadius: 8,
                    background: `${catColors[r.category]}18`,
                    display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 15,
                    flexShrink: 0 }}>
                    {catIcons[r.category]}
                  </div>

                  {/* Category + Detail */}
                  <div style={{ flex: 1 }}>
                    <div style={{ color: C.text, fontSize: 13,
                      fontWeight: 700 }}>
                      {catLabels[r.category]}
                    </div>
                    <div style={{ color: C.muted, fontSize: 11,
                      marginTop: 2 }}>
                      {r.distance_km != null &&
                        `📍 ${r.distance_km} km`}
                      {r.units_consumed != null &&
                        `⚡ ${r.units_consumed} kWh`}
                      {r.quantity != null &&
                        `🍽️ Qty: ${r.quantity}`}
                      {" · "}
                      {new Date(r.created_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit", minute: "2-digit"
                      })}
                    </div>
                  </div>

                  {/* CO₂ Value */}
                  <div style={{ color: catColors[r.category],
                    fontWeight: 900, fontSize: 15,
                    flexShrink: 0 }}>
                    {parseFloat(r.calculated_co2).toFixed(3)} kg
                  </div>
                </div>
              ))}
            </div>

            {/* Day Summary Bar */}
            <div style={{ marginTop: 12, padding: "10px 14px",
              background: `${dayColor}08`,
              border: `1px solid ${dayColor}22`,
              borderRadius: 10,
              display: "flex", justifyContent: "space-between",
              alignItems: "center" }}>
              <div style={{ display: "flex", gap: 18 }}>
                {["transport", "energy", "food"].map(cat => {
                  const catTotal = records
                    .filter(r => r.category === cat)
                    .reduce((s, r) =>
                      s + parseFloat(r.calculated_co2 || 0), 0);
                  if (catTotal === 0) return null;
                  return (
                    <div key={cat} style={{ display: "flex",
                      alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: 13 }}>
                        {catIcons[cat]}
                      </span>
                      <span style={{ color: catColors[cat],
                        fontSize: 12, fontWeight: 700 }}>
                        {catTotal.toFixed(3)} kg
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center",
                gap: 6 }}>
                <span style={{ color: C.muted, fontSize: 11 }}>
                  Total:
                </span>
                <span style={{ color: dayColor, fontSize: 13,
                  fontWeight: 900 }}>
                  {dayTotal.toFixed(3)} kg CO₂
                </span>
              </div>
            </div>
          </Card>
        );
      });
    })()}
  </div>
);
  if (tab === "challenges") {
  const allChallenges = dbChallenges.map(c => ({
  emoji: c.emoji,
  type: c.challenge_type,
  title: c.title,
  desc: c.description,
  pts: c.points,
  ends: c.end_date ? new Date(c.end_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "No end date"
}));

  const joinChallenge = async (c) => {
    const already = myChallenges.find(m => m.challenge_type === c.type);
    if (already) return;
    setChallengeLoading(true);
    try {
      await API.joinChallenge(c.type, c.title, c.pts);
      await fetchChallenges();
    } catch (err) {
      console.error(err);
    } finally {
      setChallengeLoading(false);
    }
  };

  return (
    <div>
      {/* Points Banner */}
      <Card style={{ marginBottom: 20, background: "linear-gradient(135deg,rgba(76,175,130,0.15),rgba(76,175,130,0.05))", border: `1px solid ${C.leaf}44` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>Your Eco Points</div>
            <div style={{ color: C.leaf, fontSize: 32, fontWeight: 900 }}>{myPoints.total_points} pts</div>
            {myPoints.badge && <div style={{ color: C.text, fontSize: 14, marginTop: 4 }}>{myPoints.badge}</div>}
          </div>
          <div style={{ fontSize: 48 }}>🏅</div>
        </div>
      </Card>

      {/* Challenge Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {allChallenges.map((c, i) => {
          const joined = myChallenges.find(m => m.challenge_type === c.type);
          const completed = joined?.completed;
          return (
            <Card key={i} style={{ border: completed ? `1px solid ${C.leaf}66` : joined ? `1px solid ${C.leaf}33` : "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{c.emoji}</div>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{c.title}</div>
              <div style={{ color: C.muted, fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>{c.desc}</div>
              <div style={{ display: "flex", justifyContent: "space-between", color: C.muted, fontSize: 11, marginBottom: 14 }}>
                <span>🏅 {c.pts} pts</span>
                <span>⏱ {c.duration_days || 7} days</span>
                <span>📅 {c.ends}</span>
              </div>
              {completed ? (
                <div style={{ textAlign: "center", padding: "8px", background: `${C.leaf}18`, borderRadius: 8, color: C.leaf, fontSize: 12, fontWeight: 700 }}>
                  ✅ Completed! +{c.pts} pts earned
                </div>
              ) : joined ? (
                <div style={{ textAlign: "center", padding: "8px", background: "rgba(255,255,255,0.04)", borderRadius: 8, color: C.muted, fontSize: 12 }}>
                  🔄 In Progress...
                </div>
              ) : (
                <Btn onClick={() => joinChallenge(c)} style={{ width: "100%", fontSize: 12 }} loading={challengeLoading}>
                  Join Challenge
                </Btn>
              )}
            </Card>
          );
        })}
      </div>

      {/* My Joined Challenges */}
      {myChallenges.length > 0 && (
        <Card style={{ marginTop: 20 }}>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📋 My Challenges</div>
          {myChallenges.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div>
                <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{m.challenge_name}</div>
                <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
  Joined: {new Date(m.joined_at).toLocaleDateString()}
  {m.end_date && ` · Ends: ${new Date(m.end_date).toLocaleDateString()}`}
</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: m.completed ? C.leaf : C.amber, fontSize: 12, fontWeight: 700 }}>
                  {m.completed ? "✅ Completed" : "🔄 In Progress"}
                </div>
                <div style={{ color: C.muted, fontSize: 11 }}>🏅 {m.points} pts</div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
if (tab === "reports") return (
  <Card>
    <SectionTitle title="📄 Download CO₂ Report" />
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
      <div style={{ background: `${C.leaf}10`, border: `1px solid ${C.leafBorder}`, borderRadius: 14, padding: "24px 28px", minWidth: 220 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Weekly Report</div>
        <div style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>Last 7 days CO₂ summary with challenges & points</div>
        <Btn onClick={() => generatePDFReport("weekly", user)} variant="primary"
          style={{ fontSize: 12, padding: "10px 20px" }}>
          ⬇️ Download Weekly PDF
        </Btn>
      </div>
      <div style={{ background: `${C.violet}10`, border: `1px solid ${C.violet}33`, borderRadius: 14, padding: "24px 28px", minWidth: 220 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🗓️</div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Monthly Report</div>
        <div style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>This month's complete CO₂ analysis</div>
        <Btn onClick={() => generatePDFReport("monthly", user)} variant="primary"
          style={{ fontSize: 12, padding: "10px 20px", background: `${C.violet}20`, color: C.violet }}>
          ⬇️ Download Monthly PDF
        </Btn>
      </div>
    </div>
  </Card>
);

if (tab === "global-leaderboard") return (
  <div>
    <h2 style={{ color: "#4ade80", marginBottom: "20px", fontSize: "20px" }}>
      🏆 Global Leaderboard
    </h2>
    <GlobalLeaderboard />
  </div>
);
if (tab === "profile") return (
  <ProfilePage user={user} onProfileUpdate={onProfileUpdate} toast={toast} />
);
  return null;
}

// ──────────────────────────────────────────────────────────
// ORG EMPLOYEE DASHBOARD
// ──────────────────────────────────────────────────────────
function OrgEmployeeDashboard({ user, tab, toast, onProfileUpdate }) {
  const [summary, setSummary] = useState(null);
  const [period, setPeriod] = useState("daily");
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [tick, setTick] = useState(0);
  const [activePolicies, setActivePolicies] = useState([]);
  const [policyNotif, setPolicyNotif] = useState(false);
  const [myChallenges, setMyChallenges] = useState([]);
  const [myPoints, setMyPoints] = useState({ total_points: 0, badge: null });
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [dbChallenges, setDbChallenges] = useState([]);

  const orgId = user.organization_id;

  // ── Summary ──────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await API.getUserSummary(user.id, period);
        setSummary(data);
      } catch {}
      finally { setLoading(false); }
    };
    load();
  }, [user.id, period, tick]);

  // ── Leaderboard ───────────────────────────
  useEffect(() => {
    if (tab !== "leaderboard" || !orgId) return;
    const load = async () => {
      try {
        const data = await API.getOrgLeaderboard(orgId, period);
        setLeaderboard(data.leaderboard || []);
      } catch {}
    };
    load();
  }, [tab, orgId, period]);

  // ── Active Policies ───────────────────────
useEffect(() => {
  if (!orgId) return;
  const load = async () => {
    try {
      const data = await API.getActivePolicies(orgId);
      const pol = data.policies || [];
      setActivePolicies(pol);
      if (pol.length > 0) setPolicyNotif(true);
    } catch {}
  };
  load();
  const interval = setInterval(load, 30000);
  return () => clearInterval(interval);
}, [orgId]);

  // ── History ───────────────────────────────
  useEffect(() => {
    if (tab !== "history" || !orgId) return;
    const load = async () => {
      setLoadingHist(true);
      try {
        const data = await API.getOrgMyHistory(orgId);
        setHistory(data.records || []);
      } catch {}
      finally { setLoadingHist(false); }
    };
    load();
  }, [tab, orgId, tick]);

  //--------------Challenges ----------------

  const fetchChallenges = async () => {
  try {
    const [ch, pts] = await Promise.all([
      API.getMyChallenges(),
      API.getMyPoints()
    ]);
    setMyChallenges(ch.challenges || []);
    setMyPoints(pts.points || { total_points: 0, badge: null });
  } catch (err) {
    console.error(err);
  }
};

useEffect(() => {
  fetchChallenges();
}, []);

useEffect(() => {
  const load = async () => {
    try {
      const res = await API.getAllChallenges();
      setDbChallenges(res.challenges || []);
    } catch (err) { console.error(err); }
  };
  load();
}, []);
  const total = summary?.grand_total || 0;
  const cats = summary?.categories || [];

  // ════════════════════════════════
  //  TAB: MY DASHBOARD
  // ════════════════════════════════
  if (tab === "overview") return (
    <div>
      <EnvBanner />
      {/* Active Policy Notification */}
{policyNotif && activePolicies.length > 0 && (
  <div style={{ background: `${C.leaf}12`, border: `1px solid ${C.leafBorder}`, borderRadius: 14, padding: "14px 18px", marginBottom: 18, position: "relative" }}>
    <button onClick={() => setPolicyNotif(false)}
      style={{ position: "absolute", top: 10, right: 12, background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>×</button>
    <div style={{ color: C.leaf, fontWeight: 800, fontSize: 13, marginBottom: 8 }}>
      🎉 Your organization has active policies applied to you!
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {activePolicies.map((pol, i) => (
        <span key={i} style={{ background: `${C.leaf}20`, color: C.leaf, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6 }}>
          ✅ {pol.policy_name} (-{(pol.impact_factor*100).toFixed(0)}% CO₂)
        </span>
      ))}
    </div>
  </div>
)}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "rgba(255,255,255,0.03)", padding: 3, borderRadius: 10, width: "fit-content" }}>
        {["daily", "monthly", "yearly"].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{ padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, textTransform: "capitalize",
              background: period === p ? `${C.violet}20` : "transparent",
              color: period === p ? C.violet : C.muted }}>
            {p}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
        <StatCard icon="🌍" label="My CO₂" value={loading ? "..." : total.toFixed(2)} unit="kg" accent={C.violet} loading={loading} />
        <StatCard icon="🚗" label="Transport" value={loading ? "..." : (cats.find(c=>c.name==="Transport")?.total||0).toFixed(2)} unit="kg" accent={C.sky} loading={loading} />
        <StatCard icon="⚡" label="Energy" value={loading ? "..." : (cats.find(c=>c.name==="Energy")?.total||0).toFixed(2)} unit="kg" accent={C.leaf} loading={loading} />
        <StatCard icon="🍽️" label="Food" value={loading ? "..." : (cats.find(c=>c.name==="Food")?.total||0).toFixed(2)} unit="kg" accent={C.amber} loading={loading} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 18 }}>
        <Card>
          <SectionTitle title="My CO₂ Gauge" />
          <CO2Gauge value={loading ? 0 : total} />
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {cats.map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: [C.sky, C.violet, C.amber][i] }} />
                  <span style={{ color: C.muted, fontSize: 12 }}>{c.name}</span>
                </div>
                <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{c.total?.toFixed(2)} kg</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Category Breakdown" />
          {!loading && cats.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={cats}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#0e1f17", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }}
                  formatter={(v) => [`${v.toFixed(3)} kg`, ""]} />
                <Bar dataKey="total" name="CO₂ (kg)" radius={[6,6,0,0]}>
                  {cats.map((_, i) => <Cell key={i} fill={[C.sky, C.violet, C.amber][i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <Spinner />}
        </Card>
      </div>
    </div>
  );

  // ════════════════════════════════
  //  TAB: LOG ACTIVITY
  // ════════════════════════════════
  if (tab === "log") return (
    <div style={{ maxWidth: 680 }}>
      <Card>
        <SectionTitle title="Log Activity" />
        <ActivityLogForm onLogged={() => setTick(t => t+1)} toast={toast} />
      </Card>
    </div>
  );

  // ════════════════════════════════
  //  TAB: LEADERBOARD 
  // ════════════════════════════════
  if (tab === "leaderboard") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Period selector */}
      <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.03)", padding: 3, borderRadius: 10, width: "fit-content" }}>
        {["daily", "monthly", "yearly"].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{ padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, textTransform: "capitalize",
              background: period === p ? `${C.violet}20` : "transparent",
              color: period === p ? C.violet : C.muted }}>
            {p}
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      <Card>
        <SectionTitle title="🏆 Department Leaderboard — Lowest CO₂ Wins!" />
        {leaderboard.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 13, padding: 20 }}>No data yet — log activities to appear here!</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {leaderboard.map((emp, i) => {
              const medals = ["🥇", "🥈", "🥉"];
              const isMe = emp.id === user.id;
              const co2 = parseFloat(emp.total_co2 || 0);
              const co2Color = co2 < 5 ? C.leaf : co2 < 10 ? C.amber : C.rose;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px",
                  background: isMe ? `${C.violet}12` : "rgba(255,255,255,0.03)",
                  borderRadius: 12,
                  border: `1px solid ${isMe ? C.violet + "44" : C.border}` }}>
                  <div style={{ fontSize: 20, width: 28, textAlign: "center", flexShrink: 0 }}>
                    {i < 3 ? medals[i] : `#${i+1}`}
                  </div>
                  <div style={{ width: 34, height: 34, borderRadius: "50%",
                    background: `${C.violet}18`, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: 16, flexShrink: 0 }}>👷</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                      {emp.name} {isMe && <span style={{ color: C.violet, fontSize: 11 }}>(You)</span>}
                    </div>
                    <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                      📁 {emp.department || "—"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: co2Color, fontSize: 16, fontWeight: 900 }}>
                      {co2.toFixed(3)} kg
                    </div>
                    <div style={{ color: C.muted, fontSize: 10 }}>CO₂</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );

  // ════════════════════════════════
  //  TAB: HISTORY
  // ════════════════════════════════
  if (tab === "history") return (
    <div>
      {loadingHist ? <Spinner /> : history.length === 0 ? (
        <Card>
          <div style={{ color: C.muted, textAlign: "center", padding: 40, fontSize: 14 }}>
            No activities yet. Log some activities! 🌱
          </div>
        </Card>
      ) : (() => {
        const grouped = {};
        history.forEach(r => {
          const dateKey = new Date(r.created_at).toLocaleDateString("en-IN", {
            weekday: "long", year: "numeric", month: "long", day: "numeric"
          });
          if (!grouped[dateKey]) grouped[dateKey] = [];
          grouped[dateKey].push(r);
        });

        const catIcons = { transport: "🚗", energy: "⚡", food: "🍽️" };
        const catColors = { transport: C.sky, energy: C.violet, food: C.amber };
        const catLabels = { transport: "Transport", energy: "Energy", food: "Food" };

        return Object.entries(grouped).map(([date, records], gi) => {
          const dayTotal = records.reduce((s, r) => s + parseFloat(r.calculated_co2 || 0), 0);
          const dayColor = dayTotal < 5 ? C.leaf : dayTotal < 10 ? C.amber : C.rose;

          return (
            <Card key={gi} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${C.leaf}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📅</div>
                  <div>
                    <div style={{ color: C.text, fontWeight: 800, fontSize: 14 }}>{date}</div>
                    <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{records.length} activities</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: dayColor, fontSize: 20, fontWeight: 900 }}>{dayTotal.toFixed(3)} kg</div>
                  <div style={{ color: C.muted, fontSize: 10 }}>Day Total CO₂</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {records.map((r, ri) => (
                  <div key={ri} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: `1px solid ${C.border}` }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${catColors[r.category]}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                      {catIcons[r.category]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{catLabels[r.category]}</div>
                      <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                        {r.distance_km != null && `📍 ${r.distance_km} km`}
                        {r.units_consumed != null && `⚡ ${r.units_consumed} kWh`}
                        {r.quantity != null && `🍽️ Qty: ${r.quantity}`}
                        {" · "}
                        {new Date(r.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <div style={{ color: catColors[r.category], fontWeight: 900, fontSize: 15, flexShrink: 0 }}>
                      {parseFloat(r.calculated_co2).toFixed(3)} kg
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12, padding: "10px 14px", background: `${dayColor}08`, border: `1px solid ${dayColor}22`, borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 18 }}>
                  {["transport", "energy", "food"].map(cat => {
                    const catTotal = records.filter(r => r.category === cat).reduce((s, r) => s + parseFloat(r.calculated_co2 || 0), 0);
                    if (catTotal === 0) return null;
                    return (
                      <div key={cat} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 13 }}>{catIcons[cat]}</span>
                        <span style={{ color: catColors[cat], fontSize: 12, fontWeight: 700 }}>{catTotal.toFixed(3)} kg</span>
                      </div>
                    );
                  })}
                </div>
                <span style={{ color: dayColor, fontSize: 13, fontWeight: 900 }}>Total: {dayTotal.toFixed(3)} kg CO₂</span>
              </div>
            </Card>
          );
        });
      })()}
    </div>
  );

  // ════════════════════════════════
  //  TAB: Policies
  // ════════════════════════════════

  if (tab === "policies") {
  return (
    <div>
      <Card>
        <SectionTitle title="📋 My Active Policies" />
        {activePolicies.length === 0 ? (
          <div style={{ color: C.muted, padding: 20, textAlign: "center", fontSize: 13 }}>
            No active policies assigned to you yet.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 14 }}>
            {activePolicies.map((pol, i) => {
              const icons = { "Work From Home": "🏠", "Carpooling": "🚗", "Solar Energy": "☀️", "Veg Cafeteria": "🥦" };
              const colors = { "Work From Home": C.sky, "Carpooling": C.amber, "Solar Energy": C.leaf, "Veg Cafeteria": C.violet };
              const color = colors[pol.policy_name] || C.leaf;
              return (
                <div key={i} style={{ background: `${color}10`, border: `1px solid ${color}33`, borderRadius: 14, padding: "20px 18px" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>{icons[pol.policy_name] || "📋"}</div>
                  <div style={{ color: C.text, fontWeight: 800, fontSize: 15, marginBottom: 6 }}>{pol.policy_name}</div>
                  <div style={{ color: color, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                    ✅ Active — -{(pol.impact_factor * 100).toFixed(0)}% CO₂
                  </div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>
                    {pol.policy_name === "Work From Home" && "Transport CO₂ -18% reduced."}
                    {pol.policy_name === "Carpooling" && "Transport CO₂ -25% reduced."}
                    {pol.policy_name === "Solar Energy" && "Energy CO₂ -40% reduced."}
                    {pol.policy_name === "Veg Cafeteria" && "Food CO₂ -30% reduced."}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

  // ═══════════════════════════
  //  TAB: challenges 
  // ═══════════════════════════════
if (tab === "challenges") {
  const allChallenges = dbChallenges.map(c => ({
  emoji: c.emoji,
  type: c.challenge_type,
  title: c.title,
  desc: c.description,
  pts: c.points,
  ends: c.end_date ? new Date(c.end_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "No end date"
}));

  const joinChallenge = async (c) => {
    const already = myChallenges.find(m => m.challenge_type === c.type);
    if (already) return;
    setChallengeLoading(true);
    try {
      await API.joinChallenge(c.type, c.title, c.pts);
      await fetchChallenges();
    } catch (err) {
      console.error(err);
    } finally {
      setChallengeLoading(false);
    }
  };

  return (
    <div>
      {/* Points Banner */}
      <Card style={{ marginBottom: 20, background: "linear-gradient(135deg,rgba(155,135,245,0.15),rgba(155,135,245,0.05))", border: `1px solid ${C.violet}44` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>Your Eco Points</div>
            <div style={{ color: C.violet, fontSize: 32, fontWeight: 900 }}>{myPoints.total_points} pts</div>
            {myPoints.badge && <div style={{ color: C.text, fontSize: 14, marginTop: 4 }}>{myPoints.badge}</div>}
          </div>
          <div style={{ fontSize: 48 }}>🏅</div>
        </div>
      </Card>

      {/* Challenge Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {allChallenges.map((c, i) => {
          const joined = myChallenges.find(m => m.challenge_type === c.type);
          const completed = joined?.completed;
          return (
            <Card key={i} style={{ border: completed ? `1px solid ${C.leaf}66` : joined ? `1px solid ${C.violet}33` : "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{c.emoji}</div>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{c.title}</div>
              <div style={{ color: C.muted, fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>{c.desc}</div>
              <div style={{ display: "flex", justifyContent: "space-between", color: C.muted, fontSize: 11, marginBottom: 14 }}>
                <span>🏅 {c.pts} pts</span>
                <span>📅 {c.ends}</span>
              </div>
              {completed ? (
                <div style={{ textAlign: "center", padding: "8px", background: `${C.leaf}18`, borderRadius: 8, color: C.leaf, fontSize: 12, fontWeight: 700 }}>
                  ✅ Completed! +{c.pts} pts earned
                </div>
              ) : joined ? (
                <div style={{ textAlign: "center", padding: "8px", background: "rgba(255,255,255,0.04)", borderRadius: 8, color: C.muted, fontSize: 12 }}>
                  🔄 In Progress...
                </div>
              ) : (
                <Btn onClick={() => joinChallenge(c)} style={{ width: "100%", fontSize: 12 }} loading={challengeLoading}>
                  Join Challenge
                </Btn>
              )}
            </Card>
          );
        })}
      </div>

      {/* My Joined Challenges */}
      {myChallenges.length > 0 && (
        <Card style={{ marginTop: 20 }}>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📋 My Challenges</div>
          {myChallenges.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div>
                <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{m.challenge_name}</div>
               <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
  Joined: {new Date(m.joined_at).toLocaleDateString()}
  {m.end_date && ` · Ends: ${new Date(m.end_date).toLocaleDateString()}`}
</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: m.completed ? C.leaf : C.amber, fontSize: 12, fontWeight: 700 }}>
                  {m.completed ? "✅ Completed" : "🔄 In Progress"}
                </div>
                <div style={{ color: C.muted, fontSize: 11 }}>🏅 {m.points} pts</div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
if (tab === "reports") return (
  <Card>
    <SectionTitle title="📄 Download CO₂ Report" />
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
      <div style={{ background: `${C.leaf}10`, border: `1px solid ${C.leafBorder}`, borderRadius: 14, padding: "24px 28px", minWidth: 220 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Weekly Report</div>
        <div style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>Last 7 days CO₂ summary with challenges & points</div>
        <Btn onClick={() => generatePDFReport("weekly", user)} variant="primary"
          style={{ fontSize: 12, padding: "10px 20px" }}>
          ⬇️ Download Weekly PDF
        </Btn>
      </div>
      <div style={{ background: `${C.violet}10`, border: `1px solid ${C.violet}33`, borderRadius: 14, padding: "24px 28px", minWidth: 220 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🗓️</div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Monthly Report</div>
        <div style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>This month's complete CO₂ analysis</div>
        <Btn onClick={() => generatePDFReport("monthly", user)} variant="primary"
          style={{ fontSize: 12, padding: "10px 20px", background: `${C.violet}20`, color: C.violet }}>
          ⬇️ Download Monthly PDF
        </Btn>
      </div>
    </div>
  </Card>
);
if (tab === "global-leaderboard") return (
  <div>
    <h2 style={{ color: "#4ade80", marginBottom: "20px", fontSize: "20px" }}>
      🏆 Global Leaderboard
    </h2>
    <GlobalLeaderboard />
  </div>
);
if (tab === "profile") return (
  <ProfilePage user={user} onProfileUpdate={onProfileUpdate} toast={toast} />
);
  return null;
}

function OrgChallengeList({ orgId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.getChallengeOrgStats(orgId);
        setData(res.participants || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orgId]);

  if (loading) return <Spinner />;
  if (data.length === 0) return (
    <div style={{ color: C.muted, padding: 20, textAlign: "center", fontSize: 13 }}>
      No employees have joined challenges yet.
    </div>
  );

  const grouped = data.reduce((acc, p) => {
    const key = p.department || "No Department";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {Object.entries(grouped).map(([dept, members], di) => (
        <div key={di}>
          <div style={{ color: C.amber, fontSize: 12, fontWeight: 700, marginBottom: 8, padding: "4px 10px", background: `${C.amber}12`, borderRadius: 6, display: "inline-block" }}>
            📁 {dept}
          </div>
          {members.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>📧 {m.email}</div>
              </div>
              <div style={{ color: C.sky, fontSize: 12, fontWeight: 600 }}>{m.challenge_name}</div>
              <div style={{ color: m.completed ? C.leaf : C.amber, fontSize: 12, fontWeight: 700 }}>
                {m.completed ? "✅ Completed" : "🔄 In Progress"}
              </div>
              <div style={{ color: C.muted, fontSize: 11 }}>🏅 {m.points} pts</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
// ──────────────────────────────────────────────────────────
// ORG ADMIN DASHBOARD
// ──────────────────────────────────────────────────────────
function OrgAdminDashboard({ user, tab, toast, onProfileUpdate }) {
  console.log("USER OBJECT:", user);
  const [summary, setSummary] = useState(null);
  const [depts, setDepts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [period, setPeriod] = useState("daily");
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState(null);

  const [expandedPolicy, setExpandedPolicy] = useState(null);
  const [assignedUsers, setAssignedUsers] = useState({});
  const [selectedUsers, setSelectedUsers] = useState([]);

  const orgId = user.organization_id;

  // Summary
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await API.getOrgSummary(orgId, period);
        setSummary(data);
      } catch {}
      finally { setLoading(false); }
    };
    load();
  }, [orgId, period]);

  // Departments
useEffect(() => {
  if (tab !== "departments") return;
  const load = async () => {
    try {
      const data = await API.getDeptSummary(orgId);
      console.log("DEPT DATA:", data); // ← add பண்ணு
      setDepts(data.departments || []);
    } catch (err) {
      console.log("DEPT ERROR:", err.message); // ← add பண்ணு
    }
  };
  load();
}, [tab, orgId]);

  // Employees
  useEffect(() => {
  if (!orgId) return;
    const load = async () => {
      try {
        const data = await API.getOrgEmployees(orgId);
        setEmployees(data.employees || []);
      } catch {}
    };
    load();
  }, [tab, orgId]);

  // Policies
 // Policies
  useEffect(() => {
    if (tab !== "policies") return;
    const load = async () => {
      try {
        const data = await API.getOrgPolicies(orgId);
        const pols = data.policies || [];
        setPolicies(pols);

        // All policies-க்கும் assigned users fetch பண்ணு
        const assignedMap = {};
        for (const pol of pols) {
          try {
            const d = await API.getPolicyAssignedUsers(pol.id);
            assignedMap[pol.id] = d.assigned_users || [];
          } catch {}
        }
        setAssignedUsers(assignedMap);
      } catch {}
    };
    load();
  }, [tab, orgId]);
  // ── Load assigned users when policy expanded ──
useEffect(() => {
  if (!expandedPolicy) return;
  API.getPolicyAssignedUsers(expandedPolicy.id)
    .then(d => {
      setAssignedUsers(p => ({
        ...p,
        [expandedPolicy.id]: d.assigned_users || []
      }));
      setSelectedUsers(d.assigned_users?.map(u => u.id) || []);
    })
    .catch(() => {});
}, [expandedPolicy]);

  const loadAssigned = async (polId) => {
  try {
    const data = await API.getPolicyAssignedUsers(polId);
    setAssignedUsers(p => ({ ...p, [polId]: data.assigned_users || [] }));
    setSelectedUsers(data.assigned_users?.map(u => u.id) || []);
  } catch {}
};

const handleExpand = (pol) => {
  if (expandedPolicy?.id === pol.id) {
    setExpandedPolicy(null);
  } else {
    setExpandedPolicy(pol);
    loadAssigned(pol.id);
  }
};

const handleAssignAll = async (pol) => {
  try {
    await API.assignPolicy(pol.id, { apply_all: true, org_id: orgId });
    await API.togglePolicy(pol.id, true);
    setPolicies(p => p.map(p2 => p2.id === pol.id ? { ...p2, enabled: true } : p2));
    toast(`✅ "${pol.policy_name}" applied to all employees!`);
    await loadAssigned(pol.id);
  } catch (e) { toast(e.message, "error"); }
};

const handleAssignSelected = async (pol) => {
  try {
    await API.unassignPolicy(pol.id, { remove_all: true });
    if (selectedUsers.length > 0) {
      await API.assignPolicy(pol.id, { user_ids: selectedUsers, org_id: orgId });
      await API.togglePolicy(pol.id, true);
      setPolicies(p => p.map(p2 => p2.id === pol.id ? { ...p2, enabled: true } : p2));
      toast(`✅ Policy updated for ${selectedUsers.length} employees`);
    } else {
      // 0 users selected = just clear assignments, keep enabled state as-is
      // Don't disable! Just notify no one is assigned
      toast(`⚠️ No employees selected — assignments cleared`, "info");
    }
    await loadAssigned(pol.id);
  } catch (e) { toast(e.message, "error"); }
};

const handleRemoveAll = async (pol) => {
  try {
    await API.unassignPolicy(pol.id, { remove_all: true });
    await API.togglePolicy(pol.id, false);
    setPolicies(p => p.map(p2 => p2.id === pol.id ? { ...p2, enabled: false } : p2));
    toast(`✅ "${pol.policy_name}" removed from all`);
    setAssignedUsers(p => ({ ...p, [pol.id]: [] }));
  } catch (e) { toast(e.message, "error"); }
};

  const cats = summary?.categories || [];
  const total = summary?.grand_total || 0;

  // ════════════════════════════════
  //  TAB: ORG OVERVIEW
  // ════════════════════════════════
  if (tab === "overview") return (
    <div>
      <EnvBanner />

      {/* Period selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "rgba(255,255,255,0.03)", padding: 3, borderRadius: 10, width: "fit-content" }}>
        {["daily", "monthly", "yearly"].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{ padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, textTransform: "capitalize",
              background: period === p ? `${C.amber}20` : "transparent",
              color: period === p ? C.amber : C.muted }}>
            {p}
          </button>
        ))}
      </div>

      {/* Stat Cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
        <StatCard icon="🏢" label="Org CO₂" value={loading ? "..." : total.toFixed(2)} unit="kg" accent={C.rose} loading={loading} />
        <StatCard icon="👥" label="Employees" value={loading ? "..." : (summary?.employee_count ?? "—")} unit="" accent={C.violet} loading={loading} />
        <StatCard icon="🚗" label="Transport" value={loading ? "..." : (cats.find(c => c.name === "Transport")?.total || 0).toFixed(2)} unit="kg" accent={C.sky} loading={loading} />
        <StatCard icon="⚡" label="Energy" value={loading ? "..." : (cats.find(c => c.name === "Energy")?.total || 0).toFixed(2)} unit="kg" accent={C.leaf} loading={loading} />
        <StatCard icon="🍽️" label="Food" value={loading ? "..." : (cats.find(c => c.name === "Food")?.total || 0).toFixed(2)} unit="kg" accent={C.amber} loading={loading} />
      </div>

      {/* Category Breakdown Chart only */}
      <Card>
        <SectionTitle title="Org CO₂ Category Breakdown" />
        {!loading && cats.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={cats} barCategoryGap="40%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 13 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} unit=" kg" />
              <Tooltip contentStyle={{ background: "#0e1f17", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }}
                formatter={(v) => [`${v.toFixed(3)} kg CO₂`, ""]} />
              <Bar dataKey="total" name="CO₂ (kg)" radius={[8, 8, 0, 0]}>
                {cats.map((_, i) => <Cell key={i} fill={[C.sky, C.violet, C.amber][i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner /></div>}
      </Card>
    </div>
  );

  // ════════════════════════════════
  //  TAB: DEPARTMENTS
  // ════════════════════════════════
  if (tab === "departments") return (
    <div>
      {selectedDept ? (
        // ── Department Detail View ──
        <div>
          <button onClick={() => setSelectedDept(null)}
            style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, color: C.muted, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12, marginBottom: 18, display: "flex", alignItems: "center", gap: 6 }}>
            ← Back to All Departments
          </button>

          <Card>
            <SectionTitle title={`📁 ${selectedDept.name} — CO₂ Breakdown`} />

            {/* Transport + Energy + Food + Total cards */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
              <StatCard icon="🚗" label="Transport" value={selectedDept.transport_co2.toFixed(3)} unit="kg" accent={C.sky} />
              <StatCard icon="⚡" label="Energy" value={selectedDept.energy_co2.toFixed(3)} unit="kg" accent={C.violet} />
              <StatCard icon="🍽️" label="Food" value={selectedDept.food_co2.toFixed(3)} unit="kg" accent={C.amber} />
              <StatCard icon="🌍" label="Total CO₂" value={selectedDept.total_co2.toFixed(3)} unit="kg" accent={C.rose} />
            </div>

            {/* Bar chart for this department */}
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={[
                { name: "Transport", value: selectedDept.transport_co2, fill: C.sky },
                { name: "Energy", value: selectedDept.energy_co2, fill: C.violet },
                { name: "Food", value: selectedDept.food_co2, fill: C.amber },
              ]} barCategoryGap="40%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 13 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} unit=" kg" />
                <Tooltip contentStyle={{ background: "#0e1f17", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }}
                  formatter={(v) => [`${v.toFixed(3)} kg CO₂`, ""]} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {[C.sky, C.violet, C.amber].map((color, i) => <Cell key={i} fill={color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Progress bars */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              {[
                { label: "Transport", value: selectedDept.transport_co2, color: C.sky, icon: "🚗" },
                { label: "Energy", value: selectedDept.energy_co2, color: C.violet, icon: "⚡" },
                { label: "Food", value: selectedDept.food_co2, color: C.amber, icon: "🍽️" },
              ].map((item, i) => {
                const pct = selectedDept.total_co2 > 0
                  ? (item.value / selectedDept.total_co2) * 100 : 0;
                return (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: C.muted, fontSize: 12 }}>{item.icon} {item.label}</span>
                      <span style={{ color: item.color, fontSize: 12, fontWeight: 700 }}>
                        {item.value.toFixed(3)} kg ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: item.color, borderRadius: 3, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      ) : (
        // ── Department List View ──
        <Card>
          <SectionTitle title="All Departments — Click to see breakdown" />
          {depts.length === 0 ? (
            <div style={{ color: C.muted, padding: 30, textAlign: "center" }}>No departments found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {depts.map((d, i) => {
                const co2Color = d.total_co2 < 10 ? C.leaf : d.total_co2 < 50 ? C.amber : C.rose;
                return (
                  <div key={i} onClick={() => setSelectedDept(d)}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", background: "rgba(255,255,255,0.03)", borderRadius: 13, border: `1px solid ${C.border}`, cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: `${C.amber}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📁</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{d.name}</div>
                      <div style={{ color: C.muted, fontSize: 11, marginTop: 3, display: "flex", gap: 14 }}>
                        <span>🚗 {d.transport_co2.toFixed(2)} kg</span>
                        <span>⚡ {d.energy_co2.toFixed(2)} kg</span>
                        <span>🍽️ {d.food_co2.toFixed(2)} kg</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: co2Color, fontSize: 18, fontWeight: 900 }}>{d.total_co2.toFixed(2)} kg</div>
                      <div style={{ color: C.muted, fontSize: 10 }}>Total CO₂</div>
                    </div>
                    <div style={{ color: C.muted, fontSize: 18 }}>›</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );

  // ════════════════════════════════
  //  TAB: EMPLOYEES
  // ════════════════════════════════
  if (tab === "employees") return (
    <Card>
      <SectionTitle title="Employee List" />
      {employees.length === 0 ? (
        <div style={{ color: C.muted, padding: 30, textAlign: "center" }}>No employees found.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {employees.map((e, i) => {
            const co2 = parseFloat(e.total_co2 || 0);
            const co2Color = co2 < 5 ? C.leaf : co2 < 10 ? C.amber : C.rose;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 13, border: `1px solid ${C.border}` }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: `${C.amber}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>👷</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{e.name}</div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                    📧 {e.email} {e.department && `· 📁 ${e.department}`}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: co2Color, fontSize: 15, fontWeight: 800 }}>{co2.toFixed(3)} kg</div>
                  <div style={{ color: C.muted, fontSize: 10 }}>Today CO₂</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );

  // ════════════════════════════════
  //  TAB: POLICIES
  // ════════════════════════════════
  if (tab === "policies") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ color: C.muted, fontSize: 12, padding: "10px 0" }}>
        ℹ️ Enable policies and assign to All or Specific employees.
      </div>

      {policies.map((pol, i) => {
        const isExpanded = expandedPolicy?.id === pol.id;
        const assigned = assignedUsers[pol.id] || [];
        const icons = { "Work From Home": "🏠", "Carpooling": "🚗", "Solar Energy": "☀️", "Veg Cafeteria": "🥦" };

        return (
          <Card key={i}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
              onClick={() => handleExpand(pol)}>
              <div style={{ fontSize: 28 }}>{icons[pol.policy_name] || "📋"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.text, fontWeight: 800, fontSize: 15 }}>{pol.policy_name}</div>
                <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                  -{(pol.impact_factor * 100).toFixed(0)}% CO₂ reduction ·
                  {pol.enabled
                    ? <span style={{ color: C.leaf }}> ✅ Active — {assigned.length} employees</span>
                    : <span style={{ color: C.rose }}> ⭕ Inactive</span>}
                </div>
              </div>
              <div style={{ color: C.muted, fontSize: 18 }}>{isExpanded ? "▲" : "▼"}</div>
            </div>

            {isExpanded && (
              <div style={{ marginTop: 18, borderTop: `1px solid ${C.border}`, paddingTop: 18 }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
                  <Btn onClick={() => handleAssignAll(pol)} variant="primary"
                    style={{ fontSize: 12, padding: "8px 18px" }}>
                    ✅ Apply to All Employees
                  </Btn>
                  <Btn onClick={() => handleAssignSelected(pol)} variant="primary"
                    style={{ fontSize: 12, padding: "8px 18px", background: `${C.violet}20`, color: C.violet }}>
                    👥 Apply to Selected ({selectedUsers.length})
                  </Btn>
                  {pol.enabled && (
                    <Btn onClick={() => handleRemoveAll(pol)} variant="danger"
                      style={{ fontSize: 12, padding: "8px 18px" }}>
                      ❌ Remove from All
                    </Btn>
                  )}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ color: C.muted, fontSize: 12, marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
                    <span>Select employees to assign:</span>
                    <button onClick={() => setSelectedUsers(
                      selectedUsers.length === employees.length ? [] : employees.map(e => e.id)
                    )} style={{ background: "none", border: "none", color: C.leaf, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                      {selectedUsers.length === employees.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
                    {employees.map((emp, ei) => {
                      const isSelected = selectedUsers.includes(emp.id);
                      const isAssigned = assigned.some(a => a.id === emp.id);
                      return (
                        <div key={ei} onClick={() => setSelectedUsers(p =>
                          isSelected ? p.filter(id => id !== emp.id) : [...p, emp.id]
                        )} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                          background: isSelected ? `${C.leaf}12` : "rgba(255,255,255,0.03)",
                          borderRadius: 10, border: `1px solid ${isSelected ? C.leafBorder : C.border}`,
                          cursor: "pointer" }}>
                          <div style={{ width: 20, height: 20, borderRadius: 4,
                            border: `2px solid ${isSelected ? C.leaf : C.muted}`,
                            background: isSelected ? C.leaf : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, flexShrink: 0 }}>
                            {isSelected && "✓"}
                          </div>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${C.violet}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👷</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{emp.name}</div>
                            <div style={{ color: C.muted, fontSize: 11 }}>{emp.email} {emp.department && `· 📁 ${emp.department}`}</div>
                          </div>
                          {isAssigned && (
                            <span style={{ color: C.leaf, fontSize: 10, fontWeight: 700, background: `${C.leaf}15`, padding: "3px 8px", borderRadius: 5 }}>
                              ✅ Assigned
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
  if (tab === "challenges") {
  return (
    <div>
      <Card>
        <SectionTitle title="👥 Employee Challenge Participation" />
        <OrgChallengeList orgId={user.organization_id} />
      </Card>
    </div>
  );
}
if (tab === "reports") return (
  <Card>
    <SectionTitle title="📄 Download CO₂ Report" />
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
      <div style={{ background: `${C.leaf}10`, border: `1px solid ${C.leafBorder}`, borderRadius: 14, padding: "24px 28px", minWidth: 220 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Weekly Report</div>
        <div style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>Last 7 days CO₂ summary with challenges & points</div>
        <Btn onClick={() => generatePDFReport("weekly", user)} variant="primary"
          style={{ fontSize: 12, padding: "10px 20px" }}>
          ⬇️ Download Weekly PDF
        </Btn>
      </div>
      <div style={{ background: `${C.violet}10`, border: `1px solid ${C.violet}33`, borderRadius: 14, padding: "24px 28px", minWidth: 220 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🗓️</div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Monthly Report</div>
        <div style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>This month's complete CO₂ analysis</div>
        <Btn onClick={() => generatePDFReport("monthly", user)} variant="primary"
          style={{ fontSize: 12, padding: "10px 20px", background: `${C.violet}20`, color: C.violet }}>
          ⬇️ Download Monthly PDF
        </Btn>
      </div>
    </div>
  </Card>
);
if (tab === "global-leaderboard") return (
  <div>
    <h2 style={{ color: "#4ade80", marginBottom: "20px", fontSize: "20px" }}>
      🏆 Global Leaderboard
    </h2>
    <GlobalLeaderboard />
  </div>
);
if (tab === "profile") return (
  <ProfilePage user={user} onProfileUpdate={onProfileUpdate} toast={toast} />
);
  return null;
}

function UserChallengeList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/challenges/all-participants", {
          headers: { Authorization: `Bearer ${API.getToken()}` }
        });
        const json = await res.json();
        setData(json.participants || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <Spinner />;
  if (data.length === 0) return (
    <div style={{ color: C.muted, padding: 20, textAlign: "center", fontSize: 13 }}>No participants yet.</div>
  );

  // Group by department
  const grouped = data.reduce((acc, p) => {
    const key = p.department || "Individual";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {Object.entries(grouped).map(([dept, members], di) => (
        <div key={di}>
          <div style={{ color: C.amber, fontSize: 12, fontWeight: 700, marginBottom: 8, padding: "4px 10px", background: `${C.amber}12`, borderRadius: 6, display: "inline-block" }}>
            📁 {dept}
          </div>
          {members.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{m.user_name}</div>
                <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>📧 {m.email} {m.organization ? `· 🏢 ${m.organization}` : ""}</div>
              </div>
              <div style={{ color: C.sky, fontSize: 12, fontWeight: 600 }}>{m.challenge_name}</div>
              <div style={{ color: m.completed ? C.leaf : C.amber, fontSize: 12, fontWeight: 700 }}>
                {m.completed ? "✅ Completed" : "🔄 In Progress"}
              </div>
              <div style={{ color: C.muted, fontSize: 11 }}>🏅 {m.points} pts</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
// ──────────────────────────────────────────────────────────
// SYSTEM ADMIN DASHBOARD
// ──────────────────────────────────────────────────────────
function SystemAdminDashboard({ tab, toast, user, onProfileUpdate}) {
  const [users, setUsers] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState("daily");
  const [chartData, setChartData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [indVsOrgData, setIndVsOrgData] = useState([]);
 const [challengeStats, setChallengeStats] = useState([]);
const [challengeLoading, setChallengeLoading] = useState(true);
const [allChallenges, setAllChallenges] = useState([]);
const [showCreateForm, setShowCreateForm] = useState(false);
const [newChallenge, setNewChallenge] = useState({ title: "", description: "", challenge_type: "", points: 100, emoji: "🏆", end_date: "", duration_days: 7  });
const [selectedChallenge, setSelectedChallenge] = useState(null);
const [challengeParticipants, setChallengeParticipants] = useState([]);
const [selectedOrg, setSelectedOrg] = useState(null);
const [orgDetail, setOrgDetail] = useState(null);
const [orgDetailLoading, setOrgDetailLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [u, o, s] = await Promise.allSettled([
          API.getAllUsers(),
          API.getAllOrgs(),
          API.getSystemStats(),
        ]);
        if (u.status === "fulfilled") setUsers(u.value?.users || []);
        if (o.status === "fulfilled") setOrgs(o.value?.organizations || []);
        if (s.status === "fulfilled") setStats(s.value);
      } catch {}
      finally { setLoading(false); }
    };
    load();
  }, []);

  useEffect(() => {
    const loadCharts = async () => {
      try {
        const res = await API.getSystemCharts(chartPeriod);
        setChartData(res.trend || []);
        setCategoryData(res.categories || []);
        setIndVsOrgData(res.ind_vs_org || []);
      } catch {
        setChartData([]);
        setCategoryData([]);
        setIndVsOrgData([]);
      }
    };
    loadCharts();
  }, [chartPeriod]);

  useEffect(() => {
  const load = async () => {
    try {
      const res = await API.getChallengeAdminStats();
      setChallengeStats(res.stats || []);
    } catch (err) {
      console.error(err);
    } finally {
      setChallengeLoading(false);
    }
  };
  load();
}, []);

useEffect(() => {
  const load = async () => {
    try {
      const res = await API.getAllChallenges();
      setAllChallenges(res.challenges || []);
    } catch (err) { console.error(err); }
  };
  load();
}, []);

  const removeUser = async (id) => {
    try {
      await API.deleteUser(id);
      setUsers(p => p.filter(u => u.id !== id));
      if (stats) setStats(p => ({ ...p, total_users: p.total_users - 1 }));
      toast("✅ User removed successfully");
    } catch (e) { toast(e.message, "error"); }
  };

  // ── Sidebar nav: Emission Factors tab remove ──
  // (Sidebar navMap-ல system_admin array-லிருந்து factors entry delete பண்ணுங்க)

  if (tab === "overview") return (
    <div>
      {/* Stat Cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard icon="👤" label="Total Users" value={loading ? "..." : (stats?.total_users ?? users.length)} unit="" accent={C.rose} loading={loading} />
        <StatCard icon="🏢" label="Organizations" value={loading ? "..." : (stats?.total_orgs ?? orgs.length)} unit="" accent={C.amber} loading={loading} />
        <StatCard icon="🌍" label="System CO₂ Today" value={loading ? "..." : (stats?.total_co2_today?.toFixed(2) ?? "0.00")} unit="kg" accent={C.leaf} loading={loading} />
        <StatCard icon="👥" label="Active Users" value={loading ? "..." : (stats?.total_users ?? 0)} unit="" accent={C.sky} loading={loading} />
      </div>

      {/* Period Selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Leaf size={14} /> CO₂ Analytics
        </h3>
        <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.03)", padding: 3, borderRadius: 10 }}>
          {["daily", "monthly", "yearly"].map(p => (
            <button key={p} onClick={() => setChartPeriod(p)}
              style={{ padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, textTransform: "capitalize", transition: "all 0.2s",
                background: chartPeriod === p ? `${C.rose}20` : "transparent",
                color: chartPeriod === p ? C.rose : C.muted }}>
              {p === "daily" ? "Last 7 Days" : p === "monthly" ? "Last 6 Months" : "Last 3 Years"}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: Trend + Category Pie */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 18, marginBottom: 18 }}>
        <Card>
          <SectionTitle title="System-wide CO₂ Trend" />
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="sysGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.rose} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={C.rose} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#0e1f17", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }}
                  formatter={(v) => [`${v.toFixed(3)} kg`, "CO₂"]} />
                <Area type="monotone" dataKey="total_co2" stroke={C.rose} fill="url(#sysGrad)" strokeWidth={2.5} name="Total CO₂" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 240, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <div style={{ fontSize: 36 }}>📊</div>
              <div style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>
                No CO₂ data yet.<br />Users need to log activities first.
              </div>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle title="By Category" />
          {categoryData.some(c => c.total > 0) ? (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                    dataKey="total" nameKey="name" paddingAngle={3}>
                    {categoryData.map((_, i) => <Cell key={i} fill={[C.sky, C.violet, C.amber][i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0e1f17", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }}
                    formatter={(v) => [`${v.toFixed(3)} kg`, ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {categoryData.map((c, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: [C.sky, C.violet, C.amber][i] }} />
                      <span style={{ color: C.muted, fontSize: 12 }}>{c.name}</span>
                    </div>
                    <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{c.total?.toFixed(2)} kg ({c.percentage}%)</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 28 }}>🥧</div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>No data yet</div>
            </div>
          )}
        </Card>
      </div>

      {/* Row 2: Individual vs Org + Stacked Category */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Card>
          <SectionTitle title="Individual vs Organization CO₂" />
          {indVsOrgData.some(d => d.individual_co2 > 0 || d.org_co2 > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={indVsOrgData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#0e1f17", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }}
                  formatter={(v) => [`${v.toFixed(3)} kg`, ""]} />
                <Legend wrapperStyle={{ color: C.muted, fontSize: 11 }} />
                <Bar dataKey="individual_co2" name="Individual" fill={C.leaf} radius={[4,4,0,0]} />
                <Bar dataKey="org_co2" name="Organization" fill={C.amber} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 28 }}>📈</div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>No comparison data yet</div>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle title="Transport / Energy / Food Breakdown" />
          {chartData.some(d => d.total_co2 > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#0e1f17", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }}
                  formatter={(v) => [`${v.toFixed(3)} kg`, ""]} />
                <Legend wrapperStyle={{ color: C.muted, fontSize: 11 }} />
                <Bar dataKey="transport_co2" name="Transport" stackId="a" fill={C.sky} />
                <Bar dataKey="energy_co2" name="Energy" stackId="a" fill={C.violet} />
                <Bar dataKey="food_co2" name="Food" stackId="a" fill={C.amber} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 28 }}>📊</div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>No breakdown data yet</div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );

  if (tab === "users") return (
    <Card>
      <SectionTitle title="All Users"
        action={<span style={{ color: C.muted, fontSize: 12 }}>{users.length} total</span>} />
      {loading ? <Spinner /> : users.length === 0 ? (
        <div style={{ color: C.muted, padding: 30, textAlign: "center", fontSize: 13 }}>No users registered yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.map((u, i) => {
            const roleColors = { individual: C.leaf, org_employee: C.violet, org_admin: C.amber };
            const roleIcons = { individual: "👤", org_employee: "👷", org_admin: "👔" };
            const co2 = parseFloat(u.today_co2 || 0);
            const co2Color = co2 < 5 ? C.leaf : co2 < 10 ? C.amber : C.rose;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 13, border: `1px solid ${C.border}` }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${roleColors[u.role] || C.leaf}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                  {roleIcons[u.role] || "👤"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{u.name || "—"}</div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>📧 {u.email}</div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 1, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {u.organization && <span>🏢 {u.organization}</span>}
                    {u.department && <span>📁 {u.department}</span>}
                    <span>📅 {new Date(u.created_at).toLocaleDateString("en-IN")}</span>
                  </div>
                </div>
                <div style={{ background: `${roleColors[u.role] || C.leaf}18`, color: roleColors[u.role] || C.leaf, fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 6, textTransform: "uppercase", flexShrink: 0 }}>
                  {u.role?.replace(/_/g, " ")}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, minWidth: 80 }}>
                  <div style={{ color: co2Color, fontSize: 15, fontWeight: 800 }}>{co2.toFixed(3)} kg</div>
                  <div style={{ color: C.muted, fontSize: 10 }}>Today CO₂</div>
                </div>
                <Btn onClick={() => removeUser(u.id)} variant="danger" style={{ padding: "7px 14px", fontSize: 11, flexShrink: 0 }}>
                  🗑 Remove
                </Btn>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );

  if (tab === "organizations") return (
  <div>
    {selectedOrg ? (
      <div>
        <button onClick={() => { setSelectedOrg(null); setOrgDetail(null); }}
          style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, color: C.muted, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12, marginBottom: 18 }}>
          ← Back to All Organizations
        </button>

        <Card>
          <SectionTitle title={`🏢 ${selectedOrg.name}`} />
          {selectedOrg.org_admin_name && (
  <div style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>
    👤 Admin: <span style={{ color: C.text, fontWeight: 700 }}>{selectedOrg.org_admin_name}</span>
  </div>
)}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            <StatCard icon="👥" label="Employees" value={selectedOrg.total_employees || 0} unit="" accent={C.violet} />
            <StatCard icon="📁" label="Departments" value={selectedOrg.total_departments || 0} unit="" accent={C.amber} />
            <StatCard icon="🌍" label="Today CO₂" value={parseFloat(selectedOrg.today_co2 || 0).toFixed(2)} unit="kg" accent={C.rose} />
          </div>

          {/* Department wise employees */}
          <SectionTitle title="👥 Employees by Department" />
          {orgDetailLoading ? <Spinner /> : orgDetail ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {Object.entries(
                orgDetail.employees.reduce((acc, emp) => {
                  const dept = emp.department || "No Department";
                  if (!acc[dept]) acc[dept] = [];
                  acc[dept].push(emp);
                  return acc;
                }, {})
              ).map(([dept, emps], di) => (
                <div key={di}>
                  <div style={{ color: C.amber, fontSize: 12, fontWeight: 700, marginBottom: 8, padding: "4px 10px", background: `${C.amber}12`, borderRadius: 6, display: "inline-block" }}>
                    📁 {dept} — {emps.length} employees
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {emps.map((emp, ei) => {
                      const co2 = parseFloat(emp.total_co2 || 0);
                      const co2Color = co2 < 5 ? C.leaf : co2 < 10 ? C.amber : C.rose;
                      return (
                        <div key={ei} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: `1px solid ${C.border}` }}>
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: `${C.violet}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👷</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{emp.name}</div>
                            <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>📧 {emp.email}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ color: co2Color, fontSize: 14, fontWeight: 800 }}>{co2.toFixed(3)} kg</div>
                            <div style={{ color: C.muted, fontSize: 10 }}>Today CO₂</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </div>
    ) : (
      <Card>
        <SectionTitle title="All Organizations"
          action={<span style={{ color: C.muted, fontSize: 12 }}>{orgs.length} total</span>} />
        {loading ? <Spinner /> : orgs.length === 0 ? (
          <div style={{ color: C.muted, padding: 30, textAlign: "center", fontSize: 13 }}>No organizations yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {orgs.map((o, i) => {
              const co2 = parseFloat(o.today_co2 || 0);
              const co2Color = co2 < 50 ? C.leaf : co2 < 200 ? C.amber : C.rose;
              return (
                <div key={i} onClick={async () => {
                  setSelectedOrg(o);
                  setOrgDetailLoading(true);
                  try {
                    const data = await API.getOrgEmployees(o.id);
                    setOrgDetail(data);
                  } catch {}
                  finally { setOrgDetailLoading(false); }
                }}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", background: "rgba(255,255,255,0.03)", borderRadius: 13, border: `1px solid ${C.border}`, cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: `${C.amber}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🏢</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{o.name}</div>
                    <div style={{ color: C.muted, fontSize: 11, marginTop: 3, display: "flex", gap: 12 }}>
                      <span>👥 {o.total_employees || 0} employees</span>
                      <span>📁 {o.total_departments || 0} departments</span>
                      <span>📅 {new Date(o.created_at).toLocaleDateString("en-IN")}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ color: co2Color, fontSize: 16, fontWeight: 800 }}>{co2.toFixed(2)} kg</div>
                    <div style={{ color: C.muted, fontSize: 10 }}>Today CO₂</div>
                  </div>
                  <div style={{ color: C.muted, fontSize: 18 }}>›</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    )}
  </div>
);
  if (tab === "challenges") {
  const handleCreate = async () => {
    try {
      await API.createChallenge(newChallenge);
      const res = await API.getAllChallenges();
      setAllChallenges(res.challenges || []);
      setShowCreateForm(false);
      setNewChallenge({ title: "", description: "", challenge_type: "", points: 100, emoji: "🏆", end_date: "" });
      toast("✅ Challenge created!");
    } catch (err) { toast(err.message, "error"); }
  };

  const handleDelete = async (id) => {
    try {
      await API.deleteChallenge(id);
      setAllChallenges(p => p.filter(c => c.id !== id));
      toast("✅ Challenge removed!");
    } catch (err) { toast(err.message, "error"); }
  };

  const handleViewParticipants = async (c) => {
    setSelectedChallenge(c);
    try {
      const res = await API.getChallengeParticipants(c.id);
      setChallengeParticipants(res.participants || []);
    } catch (err) { console.error(err); }
  };

  const handleRemoveUser = async (challengeId, userId) => {
    try {
      await API.removeUserFromChallenge(challengeId, userId);
      setChallengeParticipants(p => p.filter(u => u.user_id !== userId));
      toast("✅ User removed!");
    } catch (err) { toast(err.message, "error"); }
  };

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <StatCard icon="🏆" label="Total Challenges" value={allChallenges.length} unit="" accent={C.leaf} />
        <StatCard icon="👥" label="Total Participants" value={challengeStats.reduce((a, c) => a + parseInt(c.participants), 0)} unit="" accent={C.amber} />
        <StatCard icon="✅" label="Total Completed" value={challengeStats.reduce((a, c) => a + parseInt(c.completed_count), 0)} unit="" accent={C.sky} />
      </div>

      {/* Create Challenge */}
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showCreateForm ? 16 : 0 }}>
          <SectionTitle title="🎯 Manage Challenges" />
          <Btn onClick={() => setShowCreateForm(p => !p)} variant={showCreateForm ? "ghost" : "primary"} style={{ fontSize: 12 }}>
            {showCreateForm ? "✕ Cancel" : "+ Create Challenge"}
          </Btn>
        </div>

        {showCreateForm && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input value={newChallenge.emoji} onChange={e => setNewChallenge(p => ({ ...p, emoji: e.target.value }))}
              placeholder="Emoji (e.g. 🚌)" style={inputStyle} />
            <input value={newChallenge.title} onChange={e => setNewChallenge(p => ({ ...p, title: e.target.value }))}
              placeholder="Challenge Title" style={inputStyle} />
            <input value={newChallenge.challenge_type} onChange={e => setNewChallenge(p => ({ ...p, challenge_type: e.target.value }))}
              placeholder="Type (e.g. car_free_week)" style={inputStyle} />
            <input value={newChallenge.points} onChange={e => setNewChallenge(p => ({ ...p, points: parseInt(e.target.value) }))}
              placeholder="Points" type="number" style={inputStyle} />
           <input value={newChallenge.end_date} onChange={e => setNewChallenge(p => ({ ...p, end_date: e.target.value }))}
  placeholder="End Date" type="date" style={{ ...inputStyle, gridColumn: "span 1" }} />

<select value={newChallenge.duration_days} onChange={e => setNewChallenge(p => ({ ...p, duration_days: parseInt(e.target.value) }))}
  style={{ ...inputStyle, gridColumn: "span 1" }}>
  <option value={7}>⏱ 7 Days</option>
  <option value={10}>⏱ 10 Days</option>
  <option value={15}>⏱ 15 Days</option>
  <option value={30}>⏱ 30 Days</option>
</select>
            <textarea value={newChallenge.description} onChange={e => setNewChallenge(p => ({ ...p, description: e.target.value }))}
              placeholder="Description" style={{ ...inputStyle, gridColumn: "span 2", minHeight: 70, resize: "vertical" }} />
            <Btn onClick={handleCreate} style={{ gridColumn: "span 2" }}>
              ✅ Create Challenge
            </Btn>
          </div>
        )}
        <Btn onClick={async () => {
  try {
    await API.runChallengeMonitor();
    toast("✅ Monitor ran! Completed challenges updated!");
  } catch (err) {
    toast(err.message, "error");
  }
}} variant="ghost" style={{ fontSize: 12 }}>
  🔍 Run Monitor Now
</Btn>
      </Card>

      {/* All Challenges List */}
      <Card style={{ marginBottom: 18 }}>
        <SectionTitle title="All Active Challenges" />
        {allChallenges.length === 0 ? (
          <div style={{ color: C.muted, padding: 20, textAlign: "center", fontSize: 13 }}>
            No challenges yet. Create one! 🎯
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {allChallenges.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 13, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 28 }}>{c.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{c.title}</div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{c.description}</div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 4, display: "flex", gap: 12 }}>
                    <span>🏅 {c.points} pts</span>
                    <span>📅 {c.end_date ? new Date(c.end_date).toLocaleDateString() : "No end date"}</span>
                    <span style={{ color: C.leaf }}>Type: {c.challenge_type}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn onClick={() => handleViewParticipants(c)} variant="ghost" style={{ fontSize: 11, padding: "6px 12px" }}>
                    👥 Participants
                  </Btn>
                  <Btn onClick={() => handleDelete(c.id)} variant="danger" style={{ fontSize: 11, padding: "6px 12px" }}>
                    🗑 Remove
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Participants Modal */}
      {selectedChallenge && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <SectionTitle title={`👥 ${selectedChallenge.title} — Participants`} />
            <button onClick={() => setSelectedChallenge(null)}
              style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          {challengeParticipants.length === 0 ? (
            <div style={{ color: C.muted, padding: 20, textAlign: "center", fontSize: 13 }}>No participants yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {challengeParticipants.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{p.user_name}</div>
                    <div style={{ color: C.muted, fontSize: 11 }}>📧 {p.email} {p.department ? `· 📁 ${p.department}` : ""}</div>
                  </div>
                  <div style={{ color: p.completed ? C.leaf : C.amber, fontSize: 12, fontWeight: 700 }}>
                    {p.completed ? "✅ Completed" : "🔄 In Progress"}
                  </div>
                  <Btn onClick={() => handleRemoveUser(selectedChallenge.id, p.user_id)} variant="danger" style={{ fontSize: 11, padding: "6px 12px" }}>
                    🗑 Remove
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Challenge Stats */}
      <Card style={{ marginTop: 18 }}>
        <SectionTitle title="Challenge Participation Overview" />
        {challengeLoading ? <Spinner /> : challengeStats.length === 0 ? (
          <div style={{ color: C.muted, padding: 20, textAlign: "center" }}>No data yet.</div>
        ) : challengeStats.map((c, i) => {
          const completionRate = c.participants > 0 ? Math.round((c.completed_count / c.participants) * 100) : 0;
          return (
            <div key={i} style={{ padding: "16px 18px", background: "rgba(255,255,255,0.03)", borderRadius: 13, border: `1px solid ${C.border}`, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{c.challenge_name}</div>
                  <div style={{ color: C.muted, fontSize: 11 }}>Type: {c.challenge_type}</div>
                </div>
                <div style={{ display: "flex", gap: 20 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: C.leaf, fontSize: 18, fontWeight: 800 }}>{c.participants}</div>
                    <div style={{ color: C.muted, fontSize: 10 }}>Participants</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: C.amber, fontSize: 18, fontWeight: 800 }}>{c.completed_count}</div>
                    <div style={{ color: C.muted, fontSize: 10 }}>Completed</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: C.sky, fontSize: 18, fontWeight: 800 }}>{c.points}</div>
                    <div style={{ color: C.muted, fontSize: 10 }}>Points</div>
                  </div>
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6, height: 6, overflow: "hidden" }}>
                <div style={{ width: `${completionRate}%`, height: "100%", background: completionRate > 50 ? C.leaf : C.amber, borderRadius: 6 }} />
              </div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>Completion Rate: {completionRate}%</div>
            </div>
          );
        })}
      </Card>

      {/* All Users Challenge Status */}
      <Card style={{ marginTop: 18 }}>
        <SectionTitle title="All Users — Challenge Status" />
        <UserChallengeList />
      </Card>
    </div>
  );
}
if (tab === "reports") return (
  <Card>
    <SectionTitle title="📄 Download CO₂ Report" />
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
      <div style={{ background: `${C.leaf}10`, border: `1px solid ${C.leafBorder}`, borderRadius: 14, padding: "24px 28px", minWidth: 220 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Weekly Report</div>
        <div style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>Last 7 days CO₂ summary with challenges & points</div>
        <Btn onClick={() => generatePDFReport("weekly", user)} variant="primary"
          style={{ fontSize: 12, padding: "10px 20px" }}>
          ⬇️ Download Weekly PDF
        </Btn>
      </div>
      <div style={{ background: `${C.violet}10`, border: `1px solid ${C.violet}33`, borderRadius: 14, padding: "24px 28px", minWidth: 220 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🗓️</div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Monthly Report</div>
        <div style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>This month's complete CO₂ analysis</div>
        <Btn onClick={() => generatePDFReport("monthly", user)} variant="primary"
          style={{ fontSize: 12, padding: "10px 20px", background: `${C.violet}20`, color: C.violet }}>
          ⬇️ Download Monthly PDF
        </Btn>
      </div>
    </div>
  </Card>
);
if (tab === "global-leaderboard") return (
  <div>
    <h2 style={{ color: "#4ade80", marginBottom: "20px", fontSize: "20px" }}>
      🏆 Global Leaderboard
    </h2>
    <GlobalLeaderboard />
  </div>
);
if (tab === "profile") return (
  <ProfilePage user={user} onProfileUpdate={onProfileUpdate} toast={toast} />
);
  return null;
}
// ──────────────────────────────────────────────────────────
// TOPBAR
// ──────────────────────────────────────────────────────────
function Topbar({ user }) {
  const [time, setTime] = useState(new Date());
  const [alerts, setAlerts] = useState([]);
  const [unread, setUnread] = useState(0);
  const [showAlerts, setShowAlerts] = useState(false);

  const [headerCity, setHeaderCity] = useState("Chennai, India");

useEffect(() => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || "Chennai";
          const state = data.address?.state || "India";
          setHeaderCity(`${city}, ${state}`);
        } catch {
          setHeaderCity("Chennai, India");
        }
      },
      () => setHeaderCity("Chennai, India")
    );
  }
}, []);


  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch alerts every 30 seconds
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const data = await API.getMyAlerts();
        setAlerts(data.alerts || []);
        setUnread(data.unread_count || 0);
      } catch {}
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleBellClick = async () => {
    setShowAlerts(!showAlerts);
    if (!showAlerts && unread > 0) {
      try {
        await API.markAlertsRead();
        setUnread(0);
        setAlerts(p => p.map(a => ({ ...a, is_read: true })));
      } catch {}
    }
  };

  const roleLabels = {
    individual: "Individual Dashboard",
    org_employee: "Employee Dashboard",
    org_admin: "Organization Dashboard",
    system_admin: "System Admin"
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 26px", borderBottom: `1px solid ${C.border}`, background: "rgba(4,16,13,0.9)", backdropFilter: "blur(12px)", flexShrink: 0, position: "relative", zIndex: 100 }}>
      <div>
        <h1 style={{ color: C.text, fontSize: 18, fontWeight: 900, margin: 0 }}>
          {roleLabels[user.role] || "Dashboard"}
        </h1>
        <p style={{ color: C.muted, fontSize: 11, margin: "2px 0 0" }}>
          {time.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · {time.toLocaleTimeString()}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* LIVE badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${C.leaf}12`, border: `1px solid ${C.leafBorder}`, borderRadius: 20, padding: "5px 14px" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.leaf, boxShadow: `0 0 5px ${C.leaf}` }} />
          <span style={{ color: C.leaf, fontSize: 11, fontWeight: 700 }}>LIVE</span>
        </div>

        {/* Location */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "5px 14px", color: C.muted, fontSize: 11 }}>
          📍 {headerCity}
        </div>

        {/* 🔔 Alert Bell */}
        <div style={{ position: "relative" }}>
          <button onClick={handleBellClick}
            style={{ position: "relative", background: unread > 0 ? `${C.rose}15` : C.surface, border: `1px solid ${unread > 0 ? C.rose + "44" : C.border}`, borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontSize: 16, transition: "all 0.2s" }}>
            🔔
            {unread > 0 && (
              <div style={{ position: "absolute", top: -6, right: -6, background: C.rose, color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 10, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {unread > 9 ? "9+" : unread}
              </div>
            )}
          </button>

          {/* Alert Dropdown */}
          {showAlerts && (
            <div style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, width: 360, background: "#0a1f14", border: `1px solid ${C.border}`, borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", zIndex: 9999, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>🔔 Alerts</span>
                <button onClick={() => setShowAlerts(false)}
                  style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>×</button>
              </div>

              <div style={{ maxHeight: 380, overflowY: "auto" }}>
                {alerts.length === 0 ? (
                  <div style={{ padding: 30, textAlign: "center", color: C.muted, fontSize: 13 }}>
                    No alerts yet 🌿
                  </div>
                ) : (
                  alerts.map((alert, i) => (
                    <div key={i} style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, background: alert.is_read ? "transparent" : `${C.rose}08`, display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ fontSize: 20, flexShrink: 0 }}>
                        {alert.alert_type === "co2_exceeded" ? "⚠️" : "👷"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: C.text, fontSize: 12, fontWeight: alert.is_read ? 500 : 700, lineHeight: 1.5 }}>
                          {alert.message}
                        </div>
                        <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>
                          {new Date(alert.sent_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      {!alert.is_read && (
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.rose, flexShrink: 0, marginTop: 4 }} />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// ──────────────────────────────────────────────────────────
// profile page
// ──────────────────────────────────────────────────────────
function ProfilePage({ user, onProfileUpdate, toast }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "" });
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.getProfile();
        setProfile(res.user);
        setForm({ name: res.user.name, email: res.user.email });
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const handlePicUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast("Image too large! Max 2MB.", "error"); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await API.uploadProfilePic(ev.target.result);
        setProfile(p => ({ ...p, profile_pic: ev.target.result }));
        onProfileUpdate({ ...user, profile_pic: ev.target.result });
        toast("✅ Profile picture updated!");
      } catch (err) { toast(err.message, "error"); }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdate = async () => {
    if (!form.name || !form.email) { toast("Name and email required!", "error"); return; }
    setSaving(true);
    try {
      await API.updateProfile(form);
      setProfile(p => ({ ...p, ...form }));
      onProfileUpdate({ ...user, name: form.name, email: form.email });
      toast("✅ Profile updated successfully!");
    } catch (err) { toast(err.message, "error"); }
    finally { setSaving(false); }
  };

  const handlePasswordChange = async () => {
    if (!pwForm.current_password || !pwForm.new_password) { toast("All fields required!", "error"); return; }
    if (pwForm.new_password !== pwForm.confirm_password) { toast("Passwords don't match!", "error"); return; }
    if (pwForm.new_password.length < 6) { toast("Password min 6 characters!", "error"); return; }
    setPwSaving(true);
    try {
      await API.changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password });
      setPwForm({ current_password: "", new_password: "", confirm_password: "" });
      toast("✅ Password changed successfully!");
    } catch (err) { toast(err.message, "error"); }
    finally { setPwSaving(false); }
  };

  const roleLabels = { individual: "Individual", org_employee: "Org Employee", org_admin: "Org Admin", system_admin: "System Admin" };
  const roleColors = { individual: C.leaf, org_employee: C.violet, org_admin: C.amber, system_admin: C.rose };
  const rc = roleColors[user.role] || C.leaf;

  if (loading) return <Spinner />;

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Profile Header Card */}
      <Card style={{ marginBottom: 20, background: `linear-gradient(135deg, ${rc}10, rgba(255,255,255,0.02))`, border: `1px solid ${rc}33` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* Profile Pic */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ width: 90, height: 90, borderRadius: "50%", border: `3px solid ${rc}66`, overflow: "hidden", background: `${rc}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>
              {profile?.profile_pic ? (
                <img src={profile.profile_pic} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span>{user.role === "individual" ? "👤" : user.role === "org_employee" ? "👷" : user.role === "org_admin" ? "👔" : "⚙️"}</span>
              )}
            </div>
            <label style={{ position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: "50%", background: rc, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, boxShadow: `0 2px 8px ${rc}66` }}>
              📷
              <input type="file" accept="image/*" onChange={handlePicUpload} style={{ display: "none" }} />
            </label>
          </div>

          {/* User Info */}
          <div style={{ flex: 1 }}>
            <div style={{ color: C.text, fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>{profile?.name}</div>
            <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{profile?.email}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <span style={{ background: `${rc}18`, color: rc, fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20 }}>
                {roleLabels[user.role]}
              </span>
              {profile?.org_name && (
                <span style={{ background: `${C.amber}18`, color: C.amber, fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20 }}>
                  🏢 {profile.org_name}
                </span>
              )}
              {profile?.dept_name && (
                <span style={{ background: `${C.sky}18`, color: C.sky, fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20 }}>
                  📁 {profile.dept_name}
                </span>
              )}
              <span style={{ background: "rgba(255,255,255,0.06)", color: C.muted, fontSize: 11, padding: "4px 12px", borderRadius: 20 }}>
                📅 Joined {new Date(profile?.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Edit Profile */}
      <Card style={{ marginBottom: 20 }}>
        <SectionTitle title="✏️ Edit Profile" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, display: "block" }}>Full Name</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Your name" style={inputStyle} />
          </div>
          <div>
            <label style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, display: "block" }}>Email Address</label>
            <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="Your email" type="email" style={inputStyle} />
          </div>
          <Btn onClick={handleUpdate} loading={saving} style={{ alignSelf: "flex-start", marginTop: 4 }}>
            💾 Save Changes
          </Btn>
        </div>
      </Card>

      {/* Change Password */}
      <Card>
        <SectionTitle title="🔐 Change Password" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, display: "block" }}>Current Password</label>
            <div style={{ position: "relative" }}>
              <input value={pwForm.current_password} onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))}
                placeholder="Current password" type={showCurrent ? "text" : "password"} style={{ ...inputStyle, paddingRight: 40 }} />
              <button onClick={() => setShowCurrent(p => !p)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 16 }}>
                {showCurrent ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          <div>
            <label style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, display: "block" }}>New Password</label>
            <div style={{ position: "relative" }}>
              <input value={pwForm.new_password} onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))}
                placeholder="New password (min 6 chars)" type={showNew ? "text" : "password"} style={{ ...inputStyle, paddingRight: 40 }} />
              <button onClick={() => setShowNew(p => !p)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 16 }}>
                {showNew ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          <div>
            <label style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, display: "block" }}>Confirm New Password</label>
            <input value={pwForm.confirm_password} onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))}
              placeholder="Confirm new password" type="password" style={inputStyle} />
          </div>
          <Btn onClick={handlePasswordChange} loading={pwSaving} style={{ alignSelf: "flex-start", marginTop: 4 }}>
            🔐 Change Password
          </Btn>
        </div>
      </Card>
    </div>
  );
}
// ──────────────────────────────────────────────────────────
// GlobalLeaderboard
// ──────────────────────────────────────────────────────────
function GlobalLeaderboard() {
  const [data, setData] = useState({ individual: [], org_employee: [] });
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    try {
      const res = await API.getLeaderboard();
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 60000); // auto refresh every 1 min
    return () => clearInterval(interval);
  }, []);

  const renderStars = (count) => "⭐".repeat(Math.min(count, 5)) || "-";

  const TopCard = ({ person, rank }) => (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      background: rank === 1 ? "linear-gradient(135deg,#052e16,#14532d)" : "rgba(255,255,255,0.04)",
      border: rank === 1 ? "1px solid #16a34a" : "1px solid rgba(255,255,255,0.08)",
      borderRadius: "12px", padding: "12px 16px", marginBottom: "10px"
    }}>
      <div style={{
        width: "32px", height: "32px", borderRadius: "50%",
        background: rank === 1 ? "#16a34a" : "#374151",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: "bold", fontSize: "14px", color: "#fff", flexShrink: 0
      }}>
        {rank === 1 ? "🥇" : "🥈"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: "600", fontSize: "14px", color: "#f0fdf4", 
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {person.name}
        </div>
        <div style={{ fontSize: "11px", color: "#86efac" }}>
          {person.org_name ? `${person.org_name}` : "Individual"}
          {person.dept_name ? ` · ${person.dept_name}` : ""}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: "700", color: "#4ade80" }}>
          {parseFloat(person.daily_co2).toFixed(3)} kg
        </div>
        <div style={{ fontSize: "11px", color: "#fbbf24" }}>
          {renderStars(parseInt(person.stars))}
        </div>
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ textAlign: "center", padding: "20px", color: "#86efac" }}>
      Loading leaderboard...
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
      {/* Individual */}
      <div style={{
        background: "rgba(255,255,255,0.03)", borderRadius: "16px",
        border: "1px solid rgba(255,255,255,0.08)", padding: "20px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <span style={{ fontSize: "20px" }}>🌍</span>
          <div>
            <div style={{ fontWeight: "700", fontSize: "15px", color: "#f0fdf4" }}>
              Individual Top 2
            </div>
            <div style={{ fontSize: "11px", color: "#86efac" }}>
              Lowest daily CO₂ emitters
            </div>
          </div>
        </div>
        {data.individual.slice(0, 2).length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: "13px" }}>No data today</div>
        ) : (
          data.individual.slice(0, 2).map((p, i) => (
            <TopCard key={p.id} person={p} rank={i + 1} />
          ))
        )}
      </div>

      {/* Org Employee */}
      <div style={{
        background: "rgba(255,255,255,0.03)", borderRadius: "16px",
        border: "1px solid rgba(255,255,255,0.08)", padding: "20px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <span style={{ fontSize: "20px" }}>🏢</span>
          <div>
            <div style={{ fontWeight: "700", fontSize: "15px", color: "#f0fdf4" }}>
              Org Employee Top 2
            </div>
            <div style={{ fontSize: "11px", color: "#86efac" }}>
              Lowest daily CO₂ emitters
            </div>
          </div>
        </div>
        {data.org_employee.slice(0, 2).length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: "13px" }}>No data today</div>
        ) : (
          data.org_employee.slice(0, 2).map((p, i) => (
            <TopCard key={p.id} person={p} rank={i + 1} />
          ))
        )}
      </div>
    </div>
  );
}
// ──────────────────────────────────────────────────────────
// Report
// ──────────────────────────────────────────────────────────
const generatePDFReport = async (period, user) => {
  try {
    const data = await API.getReportData(period);
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const periodLabel = period === "weekly" ? "Weekly" : "Monthly";

    // ── Header ──
    doc.setFillColor(14, 31, 23);
    doc.rect(0, 0, pageW, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("ClimaTrack CO2 Tracker", 14, 18);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`${periodLabel} Report`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, pageW - 14, 28, { align: "right" });

    // ── User Info ──
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Report Information", 14, 52);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${data.user?.name || "-"}`, 14, 62);
    doc.text(`Email: ${data.user?.email || "-"}`, 14, 70);
    doc.text(`Role: ${data.user?.role || "-"}`, 14, 78);
    doc.text(`Period: ${data.period}`, 14, 86);
    if (data.user?.org_name) doc.text(`Organization: ${data.user.org_name}`, 14, 94);

    // ════════════════════════════════════
    //  SYSTEM ADMIN PDF
    // ════════════════════════════════════
    if (data.role === "system_admin") {
      let y = 108;

      // System Total
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("System-Wide CO2 Summary", 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Category", "Total CO2 (kg)"]],
        body: [
          ["Transport", data.system_total.transport.toFixed(3)],
          ["Energy", data.system_total.energy.toFixed(3)],
          ["Food", data.system_total.food.toFixed(3)],
          ["TOTAL", data.system_total.total.toFixed(3)],
        ],
        headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        styles: { fontSize: 10 },
      });

      // Org Breakdown
      y = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Organization-wise CO2 Breakdown", 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Organization", "Employees", "Total CO2 (kg)"]],
        body: data.org_breakdown.map(o => [
          o.org_name || "-",
          o.employee_count,
          parseFloat(o.total_co2).toFixed(3),
        ]),
        headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        styles: { fontSize: 10 },
      });

      // Individual Users Breakdown
      y = doc.lastAutoTable.finalY + 12;
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Individual Users CO2 Breakdown", 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Name", "Email", "Total CO2 (kg)"]],
        body: data.individual_breakdown.map(u => [
          u.name,
          u.email,
          parseFloat(u.total_co2).toFixed(3),
        ]),
        headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        styles: { fontSize: 9 },
      });

      // Daily Trend
      y = doc.lastAutoTable.finalY + 12;
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Daily CO2 Trend", 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Date", "Total CO2 (kg)"]],
        body: data.trend.map(t => [
          new Date(t.date).toLocaleDateString("en-IN"),
          parseFloat(t.total).toFixed(3),
        ]),
        headStyles: { fillColor: [22, 101, 52], textColor: 255 },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        styles: { fontSize: 9 },
      });
    }

    // ════════════════════════════════════
    //  ORG ADMIN PDF
    // ════════════════════════════════════
    else if (data.role === "org_admin") {
      let y = 108;

      // Org Total
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Organization CO2 Summary", 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Category", "Total CO2 (kg)"]],
        body: [
          ["Transport", data.org_total.transport.toFixed(3)],
          ["Energy", data.org_total.energy.toFixed(3)],
          ["Food", data.org_total.food.toFixed(3)],
          ["TOTAL", data.org_total.total.toFixed(3)],
        ],
        headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        styles: { fontSize: 10 },
      });

      // Dept Breakdown
      y = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Department-wise CO2 Breakdown", 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Department", "Employees", "Total CO2 (kg)"]],
        body: data.dept_breakdown.map(d => [
          d.department || "No Department",
          d.employee_count,
          parseFloat(d.total_co2).toFixed(3),
        ]),
        headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        styles: { fontSize: 10 },
      });

      // Employee Breakdown
      y = doc.lastAutoTable.finalY + 12;
      if (y > 200) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Employee-wise CO2 Breakdown", 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Name", "Department", "Transport", "Energy", "Food", "Total (kg)"]],
        body: data.emp_breakdown.map(e => [
          e.name,
          e.department || "-",
          parseFloat(e.transport_co2).toFixed(3),
          parseFloat(e.energy_co2).toFixed(3),
          parseFloat(e.food_co2).toFixed(3),
          parseFloat(e.total_co2).toFixed(3),
        ]),
        headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        styles: { fontSize: 9 },
      });

      // Daily Trend
      y = doc.lastAutoTable.finalY + 12;
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Daily CO2 Trend", 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Date", "Total CO2 (kg)"]],
        body: data.trend.map(t => [
          new Date(t.date).toLocaleDateString("en-IN"),
          parseFloat(t.total).toFixed(3),
        ]),
        headStyles: { fillColor: [22, 101, 52], textColor: 255 },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        styles: { fontSize: 9 },
      });
    }

    // ════════════════════════════════════
    //  INDIVIDUAL / ORG EMPLOYEE PDF
    // ════════════════════════════════════
    else {
      let y = data.user?.org_name ? 102 : 94;

      // CO2 Summary
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(`CO2 Summary - ${data.period}`, 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Category", "Current", "Previous", "Change"]],
        body: [
          ["Transport", `${data.current.transport.toFixed(3)} kg`, `${data.previous.transport.toFixed(3)} kg`, `${(data.current.transport - data.previous.transport).toFixed(3)} kg`],
          ["Energy",    `${data.current.energy.toFixed(3)} kg`,    `${data.previous.energy.toFixed(3)} kg`,    `${(data.current.energy - data.previous.energy).toFixed(3)} kg`],
          ["Food",      `${data.current.food.toFixed(3)} kg`,      `${data.previous.food.toFixed(3)} kg`,      `${(data.current.food - data.previous.food).toFixed(3)} kg`],
          ["Total",     `${data.current.total.toFixed(3)} kg`,     `${data.previous.total.toFixed(3)} kg`,     `${(data.current.total - data.previous.total).toFixed(3)} kg`],
        ],
        headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        styles: { fontSize: 10 },
      });

      // Points & Badge
      y = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Eco Points & Badge", 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Total Points", "Badge"]],
        body: [[`${data.points.total_points} pts`, data.points.badge]],
        headStyles: { fillColor: [22, 101, 52], textColor: 255 },
        styles: { fontSize: 10 },
      });

      // Challenges
      y = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Challenge Progress", 14, y);
      y += 6;
      if (data.challenges.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["Challenge", "Status", "Points", "Joined", "End Date"]],
          body: data.challenges.map(c => [
            c.challenge_name,
            c.completed ? "Completed" : "In Progress",
            `${c.points} pts`,
            new Date(c.joined_at).toLocaleDateString("en-IN"),
            c.end_date ? new Date(c.end_date).toLocaleDateString("en-IN") : "-",
          ]),
          headStyles: { fillColor: [22, 101, 52], textColor: 255 },
          alternateRowStyles: { fillColor: [240, 253, 244] },
          styles: { fontSize: 10 },
        });
      } else {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("No challenges joined yet.", 14, y + 6);
        y += 16;
      }

      // Daily Trend
      y = (doc.lastAutoTable?.finalY || y) + 12;
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Daily CO2 Trend", 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Date", "Total CO2 (kg)"]],
        body: data.trend.map(t => [
          new Date(t.date).toLocaleDateString("en-IN"),
          parseFloat(t.total).toFixed(3),
        ]),
        headStyles: { fillColor: [22, 101, 52], textColor: 255 },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        styles: { fontSize: 9 },
      });
    }

    // ── Footer ──
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `ClimaTrack CO2 Report | Page ${i} of ${totalPages}`,
        pageW / 2, 290, { align: "center" }
      );
    }

   const pdfBlob = doc.output("blob");
   const pdfUrl = URL.createObjectURL(pdfBlob);
   window.open(pdfUrl, "_blank");

  } catch (err) {
    alert("PDF Error: " + err.message);
  }
};
// ──────────────────────────────────────────────────────────
// ROOT APP
// ──────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => API.getUser());
  const [activeTab, setActiveTab] = useState("overview");
  const [toast, setToast] = useState(null);
  const [showLanding, setShowLanding] = useState(() => !API.getUser());

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type, id: Date.now() });
  }, []);

  const handleProfileUpdate = useCallback((updatedUser) => {
    setUser(updatedUser);
    API.setUser(updatedUser);
  }, []);

  const handleLogin = async (userData) => {
  setUser(userData);
  setActiveTab("overview");
  try {
    const res = await API.getProfile();
    if (res.user?.profile_pic) {
      const updatedUser = { ...userData, profile_pic: res.user.profile_pic };
      setUser(updatedUser);
      API.setUser(updatedUser);
    }
  } catch {}
};
  const handleLogout = () => {
    API.clearToken();
    API.clearUser();
    setUser(null);
  };

  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get("token");
  if (window.location.pathname === "/reset-password" && resetToken) {
    return <ResetPasswordPage token={resetToken} />;
  }

  if (!user && showLanding) return (
  <LandingPage
    onGetStarted={() => setShowLanding(false)}
    onSignIn={() => setShowLanding(false)}
  />
);
if (!user) return <AuthPage onLogin={handleLogin} onBack={() => setShowLanding(true)} />;

  const dashProps = { user, tab: activeTab, toast: showToast, onProfileUpdate: handleProfileUpdate };

  return (
    <div style={{ height: "100vh", background: C.bg, fontFamily: font, display: "flex", overflow: "hidden", color: C.text }}>
      <div style={{ position: "fixed", inset: 0, backgroundImage: `radial-gradient(${C.leaf}06 1px, transparent 1px)`, backgroundSize: "28px 28px", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 250, background: `linear-gradient(0deg, ${C.leafDim} 0%, transparent 100%)`, pointerEvents: "none", zIndex: 0 }} />

      <Sidebar user={user} onLogout={handleLogout} activeTab={activeTab} setActiveTab={setActiveTab} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", zIndex: 1 }}>
        <Topbar user={user} />
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px" }}>
          {user.role === "individual" && <IndividualDashboard {...dashProps} />}
          {user.role === "org_employee" && <OrgEmployeeDashboard {...dashProps} />}
          {user.role === "org_admin" && <OrgAdminDashboard {...dashProps} />}
          {user.role === "system_admin" && <SystemAdminDashboard {...dashProps} />}
        </div>
      </div>

      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
        @keyframes slideUp { from{transform:translateY(18px);opacity:0} to{transform:translateY(0);opacity:1} }
        select option { background: #0a1f14; color: #e8f5e9; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(76,175,130,0.2); border-radius: 10px; }
        input::placeholder { color: rgba(93,122,101,0.7); }
        input:focus { border-color: rgba(76,175,130,0.4) !important; }
      `}</style>
    </div>
  );
}