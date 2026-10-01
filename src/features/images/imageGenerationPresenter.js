const IMAGE_GENERATION_UNAVAILABLE = "No pude generar esa imagen ahora. Inténtalo de nuevo más tarde.";

function presentImageGenerationResult(result) {
  if (result.ok) return { ok: true, action: "generate_image" };
  if (result.code === "IMAGE_GENERATION_COOLDOWN") {
    const minutes = Math.max(1, Math.ceil(result.data.remainingMs / 60_000));
    return { ok: false, code: result.code, message: `Espera ${minutes} ${minutes === 1 ? "minuto" : "minutos"} antes de generar otra imagen.` };
  }
  return { ok: false, code: result.code, message: IMAGE_GENERATION_UNAVAILABLE };
}

module.exports = { IMAGE_GENERATION_UNAVAILABLE, presentImageGenerationResult };
