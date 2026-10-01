const { COMMANDS } = require("../../config/commandConstants");

const WEATHER_USAGE = `Uso: ${COMMANDS.WEATHER} [fecha] [ubicación]`;
const WEATHER_UNAVAILABLE = "No pude consultar el clima para esa fecha. Inténtalo con una fecha próxima.";

function presentWeatherResult(result) {
  if (result.ok) return { ok: true, action: "get_weather", message: formatWeatherReport(result.data.weather) };
  return { ok: false, code: result.code, message: result.code === "WEATHER_DATE_INVALID" ? WEATHER_USAGE : WEATHER_UNAVAILABLE };
}

function formatWeatherReport(weather) {
  return `🌦️ ${weather.forecastLabel} en ${weather.location}\n${weather.condition}\nMin: ${weather.minTemperature}°C – Max: ${weather.maxTemperature}°C\nLluvia: ${weather.precipitationChance}% (${weather.precipitation} mm) · Viento: ${weather.maxWindSpeed} km/h`;
}

module.exports = { formatWeatherReport, presentWeatherResult };
