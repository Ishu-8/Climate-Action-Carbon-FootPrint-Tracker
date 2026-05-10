// ═══════════════════════════════════════════════════════════
//  ClimaTrack - API Service Layer
//  All real-time calls to Node.js backend (localhost:5000)
// ═══════════════════════════════════════════════════════════

const BASE_URL = "http://localhost:5000/api";

// ── Token helpers ──────────────────────────────────────────
export const getToken = () => localStorage.getItem("climatrack_token");
export const setToken = (t) => localStorage.setItem("climatrack_token", t);
export const clearToken = () => localStorage.removeItem("climatrack_token");
export const getUser = () => {
  const u = localStorage.getItem("climatrack_user");
  return u ? JSON.parse(u) : null;
};
export const setUser = (u) =>
  localStorage.setItem("climatrack_user", JSON.stringify(u));
export const clearUser = () => localStorage.removeItem("climatrack_user");

// ── Base fetch ─────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "API Error");
  return data;
}

// ══════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════
export const authLogin = (email, password) =>
  apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });

export const authRegister = (payload) =>
  apiFetch("/auth/register", { method: "POST", body: JSON.stringify(payload) });

// ══════════════════════════════════════════════════════════
//  ACTIVITIES
// ══════════════════════════════════════════════════════════
export const addTransport = (payload) =>
  apiFetch("/transport", { method: "POST", body: JSON.stringify(payload) });

export const getTransport = () => apiFetch("/transport");

export const addEnergy = (payload) =>
  apiFetch("/energy/add", { method: "POST", body: JSON.stringify(payload) });

export const getEnergy = () => apiFetch("/energy");

export const addFood = (payload) =>
  apiFetch("/food/add", { method: "POST", body: JSON.stringify(payload) });

export const getFood = () => apiFetch("/food");

// ══════════════════════════════════════════════════════════
//  SUMMARY
// ══════════════════════════════════════════════════════════
export const getUserSummary = (userId, period = "daily") =>
  apiFetch(`/summary/user/${userId}?period=${period}`);

export const getOrgSummary = (orgId, period = "daily") =>
  apiFetch(`/summary/org/${orgId}?period=${period}`);

// ══════════════════════════════════════════════════════════
//  EMISSION FACTORS (from backend DB)
// ══════════════════════════════════════════════════════════
export const getTransportFactors = () => apiFetch("/factors/transport");
export const getEnergyFactors = () => apiFetch("/factors/energy");
export const getFoodFactors = () => apiFetch("/factors/food");
export const getAdjustmentFactors = () => apiFetch("/factors/adjustment");

// ══════════════════════════════════════════════════════════
//  SYSTEM ADMIN
// ══════════════════════════════════════════════════════════
export const getAllUsers = () => apiFetch("/admin/users");
export const deleteUser = (id) =>
  apiFetch(`/admin/users/${id}`, { method: "DELETE" });
export const toggleUserStatus = (id, status) =>
  apiFetch(`/admin/users/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
export const getAllOrgs = () => apiFetch("/admin/organizations");
export const getSystemStats = () => apiFetch("/admin/stats");
export const updateEmissionFactor = (table, id, factor) =>
  apiFetch(`/admin/factors/${table}/${id}`, {
    method: "PUT",
    body: JSON.stringify({ emission_factor: factor }),
  });

// ══════════════════════════════════════════════════════════
//  ORG ADMIN
// ══════════════════════════════════════════════════════════
export const getOrgEmployees = (orgId) => apiFetch(`/org/${orgId}/employees`);
export const getOrgDepts = (orgId) => apiFetch(`/org/${orgId}/departments`);
export const getDeptSummary = (orgId) => apiFetch(`/org/${orgId}/dept-summary`);
export const getOrgPolicies = (orgId) => apiFetch(`/org/${orgId}/policies`);
export const togglePolicy = (policyId, enabled) =>
  apiFetch(`/org/policies/${policyId}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });

// ══════════════════════════════════════════════════════════
//  ENVIRONMENTAL APIs (Weather + AQI via backend proxy)
// ══════════════════════════════════════════════════════════
export const getEnvironmentalData = (city = "Chennai") =>
  apiFetch(`/environment?city=${encodeURIComponent(city)}`);

// ══════════════════════════════════════════════════════════
//  GPS GEOLOCATION (Browser API - no backend needed)
// ══════════════════════════════════════════════════════════
export const getCurrentLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

export const watchLocation = (onUpdate, onError) => {
  if (!navigator.geolocation) {
    onError(new Error("Geolocation not supported"));
    return null;
  }
  return navigator.geolocation.watchPosition(
    (pos) =>
      onUpdate({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        speed: pos.coords.speed,
        accuracy: pos.coords.accuracy,
      }),
    onError,
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
};

export const clearWatch = (watchId) => {
  if (watchId) navigator.geolocation.clearWatch(watchId);
};

// ══════════════════════════════════════════════════════════
//  HAVERSINE - distance between GPS coordinates (km)
// ══════════════════════════════════════════════════════════
export const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ══════════════════════════════════════════════════════════
//  LOCAL CO₂ CALCULATION ENGINE (mirrors backend formula)
//  Used for instant preview before POST to backend
// ══════════════════════════════════════════════════════════
export const calcTransportCO2 = (distanceKm, emissionFactor, trafficMult, acMult) =>
  +(distanceKm * emissionFactor * trafficMult * acMult).toFixed(4);

export const calcEnergyCO2 = (kwh, emissionFactor) =>
  +(kwh * emissionFactor).toFixed(4);

export const calcFoodCO2 = (qty, emissionFactor) =>
  +(qty * emissionFactor).toFixed(4);

export const getSystemCharts = (period = "daily") =>
  apiFetch(`/admin/charts?period=${period}`);

export const getOrgLeaderboard = (orgId, period = "daily") =>
  apiFetch(`/org/${orgId}/leaderboard?period=${period}`);

export const getOrgMyHistory = (orgId) =>
  apiFetch(`/org/${orgId}/my-history`);

export const assignPolicy = (policyId, payload) =>
  apiFetch(`/org/policies/${policyId}/assign`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const unassignPolicy = (policyId, payload) =>
  apiFetch(`/org/policies/${policyId}/unassign`, {
    method: "DELETE",
    body: JSON.stringify(payload),
  });

export const getPolicyAssignedUsers = (policyId) =>
  apiFetch(`/org/policies/${policyId}/assigned-users`);

export const getActivePolicies = (orgId) =>
  apiFetch(`/org/${orgId}/active-policies`);

export const getMyAlerts = () => apiFetch("/org/my-alerts");
export const markAlertsRead = () => apiFetch("/org/alerts/mark-read", { method: "PATCH" });

export const joinChallenge = (challenge_type, challenge_name, points) =>
  apiFetch("/challenges/join", { method: "POST", body: JSON.stringify({ challenge_type, challenge_name, points }) });

export const getMyChallenges = () => apiFetch("/challenges/my");
export const getMyPoints = () => apiFetch("/challenges/my-points");
export const getChallengeAdminStats = () => apiFetch("/challenges/admin-stats");
export const getChallengeOrgStats = (orgId) => apiFetch(`/challenges/org-stats/${orgId}`);
export const getAllChallenges = () => apiFetch("/challenges/all");
export const createChallenge = (payload) => apiFetch("/challenges/create", { method: "POST", body: JSON.stringify(payload) });
export const deleteChallenge = (id) => apiFetch(`/challenges/${id}`, { method: "DELETE" });
export const getChallengeParticipants = (id) => apiFetch(`/challenges/${id}/participants`);
export const removeUserFromChallenge = (challengeId, userId) => apiFetch(`/challenges/${challengeId}/remove-user/${userId}`, { method: "DELETE" });
export const runChallengeMonitor = () => apiFetch("/challenges/run-monitor", { method: "POST" });
export const getReportData = (period) => apiFetch(`/report/data?period=${period}`);
export const getLeaderboard = () => apiFetch("/leaderboard/daily");
export const awardLeaderboardStars = () => apiFetch("/leaderboard/award-stars", { method: "POST" });
export const getProfile = () => apiFetch("/profile");
export const updateProfile = (payload) => apiFetch("/profile/update", { method: "PATCH", body: JSON.stringify(payload) });
export const changePassword = (payload) => apiFetch("/profile/change-password", { method: "PATCH", body: JSON.stringify(payload) });
export const uploadProfilePic = (profile_pic) => apiFetch("/profile/upload-pic", { method: "PATCH", body: JSON.stringify({ profile_pic }) });