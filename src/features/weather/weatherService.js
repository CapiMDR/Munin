const { failure, success } = require("../../core/result");

async function getWeather({ date, location }, openMeteoApi) {
  try {
    const weather = await openMeteoApi?.getWeather(date, location);
    return weather ? success("WEATHER_FOUND", { weather }) : failure("WEATHER_UNAVAILABLE");
  } catch (error) {
    console.error("Could not fetch weather:", error.message);
    if (error.message === "Invalid weather date.") return failure("WEATHER_DATE_INVALID");
    if (error.message === "Location not found.") return failure("WEATHER_LOCATION_NOT_FOUND", { location });
    return failure("WEATHER_UNAVAILABLE");
  }
}

module.exports = { getWeather };
