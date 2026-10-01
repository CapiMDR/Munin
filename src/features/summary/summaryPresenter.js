const { COMMANDS } = require("../../config/commandConstants");

const SUMMARY_EMPTY = "No hay mensajes anteriores para resumir en este chat.";
const SUMMARY_UNAVAILABLE = "No pude generar el resumen. Inténtalo de nuevo.";

function presentSummaryResult(result) {
  if (result.ok && result.code === "SUMMARY_PREPARED") return { ok: true, action: "summarize_messages", ...result.data };
  if (result.ok && result.code === "SUMMARY_GENERATED") return { ok: true, action: "summarize_messages", message: result.data.summary };

  const message = getSummaryErrorMessage(result);
  return { ok: false, code: result.code, message };
}

function getSummaryErrorMessage(result) {
  if (result.code === "SUMMARY_EMPTY") return SUMMARY_EMPTY;
  if (result.code === "SUMMARY_GENERATION_UNAVAILABLE") return SUMMARY_UNAVAILABLE;
  return `Uso: ${COMMANDS.SUMMARY} <cantidad entre 1 y ${result.data?.maxAmount}>`;
}

module.exports = { presentSummaryResult };
