const { getMexicoCityDateParts } = require("./timeUtils");

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
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

  async getWeather(dateInput) {
    const date = parseWeatherDate(dateInput);
    if (!date) throw new Error("Invalid weather date.");

    const params = new URLSearchParams({
      latitude: String(this.latitude),
      longitude: String(this.longitude),
      timezone: DEFAULT_LOCATION.timeZone,
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
        location: this.locationName,
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
}

function parseWeatherDate(input) {
  const { year, month, day } = getMexicoCityDateParts();
  if (input === undefined || input === null || input === "") return formatDate(year, month, day);
  const match = String(input)
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return undefined;
  return formatDate(year, Number(match[2]), Number(match[1]));
}

function formatDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return {
    iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    display: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`,
  };
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
