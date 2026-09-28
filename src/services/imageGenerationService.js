const { failure, success } = require("./result");

const MAX_IMAGE_PROMPT_LENGTH = 2_048;

async function generateImage({ chatId, mentionId, prompt }, { adminStore, userStatsStore, cooldownMs = 0, onGenerationStart, sendGeneratedImage } = {}) {
  const normalizedPrompt = typeof prompt === "string" ? prompt.trim() : "";
  const normalizedCooldownMs = Number.isFinite(cooldownMs) && cooldownMs >= 0 ? cooldownMs : 0;
  if (!chatId || !normalizedPrompt || normalizedPrompt.length > MAX_IMAGE_PROMPT_LENGTH) return failure("IMAGE_PROMPT_INVALID");
  if (typeof sendGeneratedImage !== "function") return failure("IMAGE_GENERATION_UNAVAILABLE");

  const isGlobalAdmin = adminStore?.isGlobalAdmin(mentionId);
  if (mentionId && !isGlobalAdmin && !userStatsStore?.canGenerateImage(chatId, mentionId)) {
    return failure("IMAGE_GENERATION_COOLDOWN", { remainingMs: userStatsStore.getImageGenerationCooldownRemaining(chatId, mentionId) });
  }

  const hasCooldownReservation = Boolean(mentionId && !isGlobalAdmin && userStatsStore);
  if (hasCooldownReservation) userStatsStore.recordImageGeneration(chatId, mentionId, normalizedCooldownMs);

  try {
    await onGenerationStart?.();
    await sendGeneratedImage(chatId, normalizedPrompt);
    return success("IMAGE_GENERATED", { prompt: normalizedPrompt });
  } catch (error) {
    if (hasCooldownReservation) userStatsStore.clearImageGenerationCooldown(chatId, mentionId);
    return failure("IMAGE_GENERATION_FAILED", { error });
  }
}

module.exports = { generateImage, MAX_IMAGE_PROMPT_LENGTH };
