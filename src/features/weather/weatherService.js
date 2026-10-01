const { failure, success } = require("../../core/result");

async function getWeather({ date, location }, openMeteoApi) {
  try {
    const weather = await openMeteoApi?.getWeather(date, location);
    return weather ? success("WEATHER_FOUND", { weather }) : failure("WEATHER_UNAVAILABLE");
  } catch (error) {
    console.error("Could not fetch weather:", error.message);
    return failure(error.message === "Invalid weather date." ? "WEATHER_DATE_INVALID" : "WEATHER_UNAVAILABLE");
  }
}

module.exports = { getWeather };
