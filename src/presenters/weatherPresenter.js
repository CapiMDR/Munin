const { MESSAGES } = require("./messages");

function presentWeatherResult(result) {
  if (result.ok) return { ok: true, action: "get_weather", message: MESSAGES.WEATHER_REPORT(result.data.weather) };
  return { ok: false, code: result.code, message: result.code === "WEATHER_DATE_INVALID" ? MESSAGES.WEATHER_USAGE : MESSAGES.WEATHER_UNAVAILABLE };
}

module.exports = { presentWeatherResult };
