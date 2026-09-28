const { MESSAGES } = require("./messages");

function presentImageGenerationResult(result) {
  if (result.ok) return { ok: true, action: "generate_image" };
  if (result.code === "IMAGE_GENERATION_COOLDOWN") {
    const minutes = Math.max(1, Math.ceil(result.data.remainingMs / 60_000));
    return { ok: false, code: result.code, message: MESSAGES.IMAGE_GENERATION_COOLDOWN(minutes) };
  }
  return { ok: false, code: result.code, message: MESSAGES.IMAGE_GENERATION_UNAVAILABLE };
}

module.exports = { presentImageGenerationResult };
