const { resolveMexicoCityDate } = require("../utils/dateUtils");

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_LOCATION = { latitude: 19.4326, longitude: -99.1332, name: "Ciudad de México", timeZone: "America/Mexico_City" };

class OpenMeteoApi {
  constructor({
    latitude = process.env.MUNIN_LATITUDE,
    longitude = process.env.MUNIN_LONGITUDE,
    locationName = process.env.MUNIN_LOCATION_NAME,
    fetchImpl = fetch,
  } = {}) {
    this.latitude = numberOrDefault(latitude, DEFAULT_LOCATION.latitude);
    this.longitude = numberOrDefault(longitude, DEFAULT_LOCATION.longitude);
    this.locationName = locationName?.trim() || DEFAULT_LOCATION.name;
    this.fetch = fetchImpl;
  }

  async getWeather(dateInput, locationInput) {
    const date = parseWeatherDate(dateInput);
    if (!date) throw new Error("Invalid weather date.");
    const location = locationInput?.trim() ? await this.findLocation(locationInput) : { ...DEFAULT_LOCATION, name: this.locationName };

    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      timezone: location.timeZone || DEFAULT_LOCATION.timeZone,
      start_date: date.iso,
      end_date: date.iso,
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max",
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetch(`${FORECAST_URL}?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Open-Meteo responded with ${response.status}.`);

      const weatherData = await response.json();
      const daily = weatherData?.daily;
      if (!daily?.time?.length) throw new Error("Open-Meteo returned no weather data for that date.");
      return {
        date: date.display,
        forecastLabel: dateInput === undefined || dateInput === null || dateInput === "" ? "Pronóstico de hoy" : `Pronóstico para el ${date.display}`,
        location: location.name,
        condition: weatherCodeDescription(daily.weather_code?.[0]),
        minTemperature: daily.temperature_2m_min?.[0],
        maxTemperature: daily.temperature_2m_max?.[0],
        precipitationChance: daily.precipitation_probability_max?.[0],
        precipitation: daily.precipitation_sum?.[0],
        maxWindSpeed: daily.wind_speed_10m_max?.[0],
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async findLocation(locationName) {
    const params = new URLSearchParams({ name: locationName.trim(), count: "1", language: "es", format: "json" });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetch(`${GEOCODING_URL}?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Open-Meteo geocoding responded with ${response.status}.`);
      const location = (await response.json())?.results?.[0];
      if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) throw new Error("Location not found.");
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        timeZone: location.timezone,
        name: formatLocationName(location),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function formatLocationName(location) {
  return [...new Set([location.name, location.admin1, location.country].filter(Boolean))].join(", ");
}

function parseWeatherDate(input) {
  const date = input === undefined || input === null || input === "" ? resolveMexicoCityDate("hoy") : resolveMexicoCityDate(String(input));
  return date && { iso: date.iso, display: date.ddmm };
}

function numberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function weatherCodeDescription(code) {
  const descriptions = {
    0: "Despejado",
    1: "Mayormente despejado",
    2: "Parcialmente nublado",
    3: "Nublado",
    45: "Niebla",
    48: "Niebla con escarcha",
    51: "Llovizna ligera",
    53: "Llovizna",
    55: "Llovizna intensa",
    61: "Lluvia ligera",
    63: "Lluvia",
    65: "Lluvia fuerte",
    71: "Nieve ligera",
    73: "Nieve",
    75: "Nieve fuerte",
    80: "Chubascos ligeros",
    81: "Chubascos",
    82: "Chubascos fuertes",
    95: "Tormenta",
    96: "Tormenta con granizo",
    99: "Tormenta fuerte con granizo",
  };
  return descriptions[code] || "condiciones variables";
}

module.exports = OpenMeteoApi;
