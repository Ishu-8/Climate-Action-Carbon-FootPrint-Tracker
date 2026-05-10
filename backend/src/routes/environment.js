const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

router.get("/", async (req, res) => {
  const city = req.query.city || "Chennai";

  try {
    // ── Weather API Call ──────────────────────
    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.WEATHER_KEY}&units=metric`
    );
    const weatherData = await weatherRes.json();

    // ── AQI API Call ──────────────────────────
    const aqiRes = await fetch(
      `https://api.waqi.info/feed/${city}/?token=${process.env.AQI_TOKEN}`
    );
    const aqiData = await aqiRes.json();

    // ── Weather Values ────────────────────────
    const temp = weatherData?.main?.temp 
      ? `${Math.round(weatherData.main.temp)}°C` 
      : "N/A";
    const humidity = weatherData?.main?.humidity 
      ? `${weatherData.main.humidity}%` 
      : "N/A";
    const windSpeed = weatherData?.wind?.speed || 0;
    const weatherMain = weatherData?.weather?.[0]?.main || "Clear";
    const weatherDesc = weatherData?.weather?.[0]?.description || "";

    // ── AQI Values ────────────────────────────
    const aqi = aqiData?.data?.aqi || 0;
    const aqiLevel =
      aqi <= 50 ? "Good" :
      aqi <= 100 ? "Moderate" :
      aqi <= 150 ? "Unhealthy for Sensitive Groups" :
      aqi <= 200 ? "Unhealthy" :
      aqi <= 300 ? "Very Unhealthy" : "Hazardous";

    // ── Smart Suggestions ─────────────────────
    const suggestions = [];

    // AQI based
   // AQI based
if (aqi > 200) {
  suggestions.push("🚨 AQI is Hazardous! Avoid all travel today — Work From Home immediately.");
} else if (aqi > 150) {
  suggestions.push("⚠️ Air quality is Unhealthy! Avoid car travel — use public transport only.");
} else if (aqi > 100) {
  suggestions.push("😷 AQI is Moderate-Unhealthy. Prefer carpooling or bus today.");
} else if (aqi <= 50) {
  suggestions.push("✅ Air quality is Good! Perfect day to walk or cycle — Zero CO₂ emission!");
} else {
  suggestions.push("🌿 AQI is Moderate. Consider using public transport today.");
}

// Weather based
if (weatherMain === "Rain" || weatherMain === "Drizzle") {
  suggestions.push("🌧️ Rainy day! Carpool with colleagues to reduce multiple car emissions.");
} else if (weatherMain === "Thunderstorm") {
  suggestions.push("⛈️ Thunderstorm alert! Work From Home today — avoid all travel.");
} else if (weatherMain === "Clear" && aqi <= 100) {
  suggestions.push("☀️ Clear weather + Good AQI! Cycling or walking is the perfect choice today!");
} else if (weatherMain === "Clouds") {
  suggestions.push("⛅ Cloudy day! Consider using EV or public transport.");
}

// Temperature based
if (weatherData?.main?.temp > 35) {
  suggestions.push("🌡️ Extreme heat! Reduce AC usage to lower your energy CO₂ footprint.");
} else if (weatherData?.main?.temp < 15) {
  suggestions.push("🥶 Cold weather! Use heating systems wisely to save energy CO₂.");
}

// Wind based
if (windSpeed > 20) {
  suggestions.push("💨 High wind speed! Great day to switch to renewable energy sources.");
}

// AQI + CO₂ combined
if (aqi > 100) {
  suggestions.push("🚗+🌫️ High AQI + Car Travel = Double environmental impact! Choose bike or walk today.");
}
    res.json({
      city,
      aqi,
      level: aqiLevel,
      temp,
      humidity,
      weather: weatherMain,
      weatherDesc,
      windSpeed: `${windSpeed} m/s`,
      suggestion: suggestions[0],
      suggestions,
    });

  } catch (error) {
    console.error("Environment API Error:", error.message);
    res.status(500).json({
      city,
      aqi: "–",
      level: "N/A",
      temp: "–",
      humidity: "–",
      weather: "–",
      suggestion: "Environmental data unavailable.",
      suggestions: [],
    });
  }
});

module.exports = router;

