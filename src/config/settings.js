require("./envLoader");

function getBooleanSetting(value, fallback = false) {
  if (typeof value !== "string") return fallback;

  return value.trim().toLowerCase() === "true";
}

function getCooldownMs(value, fallback) {
  if (typeof value !== "string" || !value.trim()) return fallback;

  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue >= 0 ? parsedValue : fallback;
}

const TEST_MODE = getBooleanSetting(process.env.TEST_MODE);
const TEST_CHAT_ID = process.env.TEST_CHAT_ID?.trim() || "";
const SEND_MAINTENANCE_MESSAGE = getBooleanSetting(process.env.SEND_MAINTENANCE_MESSAGE);
const FEATHER_COOLDOWN_MS = getCooldownMs(process.env.FEATHER_COOLDOWN_MS, 30 * 60 * 1_000); //30 mins
const IMAGE_GENERATION_COOLDOWN_MS = getCooldownMs(process.env.IMAGE_GENERATION_COOLDOWN_MS, 2 * 60 * 1_000); // 2 mins

module.exports = {
  TEST_MODE,
  TEST_CHAT_ID,
  SEND_MAINTENANCE_MESSAGE,
  FEATHER_COOLDOWN_MS,
  IMAGE_GENERATION_COOLDOWN_MS,
};
