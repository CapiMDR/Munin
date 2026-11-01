const { COMMANDS } = require("../../config/commandConstants");
const { formatMexicoCityDateTime, formatRemainingDuration } = require("../../utils/timeUtils");

function presentCronometerResult(result) {
  if (!result.ok) return { ok: false, code: result.code, message: cronometerUsage() };
  if (result.code === "CRONOMETER_SAVED") {
    return {
      ok: true,
      action: "save_cronometer",
      message: `Cronómetro guardado: ${result.data.cronometer.title}\n\n${formatCronometers(result.data.cronometers)}`,
    };
  }
  if (result.code === "CRONOMETERS_LISTED") return { ok: true, action: "list_cronometers", message: formatCronometers(result.data.cronometers) };
  if (result.code === "CRONOMETERS_DELETED") {
    const confirmation = result.data.deleted.length
      ? `Se eliminaron ${result.data.deleted.length} cronómetros.`
      : "No encontré cronómetros para eliminar.";
    const invalid = result.data.invalidIndexes.length ? `\nNo encontré los índices: ${result.data.invalidIndexes.join(", ")}.` : "";
    return {
      ok: true,
      action: "delete_cronometers",
      message: `${confirmation}${invalid}\n\n${formatCronometers(result.data.cronometers)}`,
    };
  }
  return { ok: false, code: "CRONOMETER_RESULT_UNKNOWN", message: cronometerUsage() };
}

function formatCronometers(cronometers, now = Date.now()) {
  if (!cronometers.length) return 'No hay cronómetros guardados en este grupo.\n\n> Dime *"Agrega un cronómetro para ver cuánto tarda la pizza"*.';
  return `Cronómetros del grupo:\n${cronometers
    .map((cronometer, index) => {
      const elapsed = Math.max(0, now - cronometer.savedAt);
      return `${index + 1}. ${cronometer.title}\nGuardado: ${formatMexicoCityDateTime(cronometer.savedAt)}\nTranscurrido: ${formatRemainingDuration(elapsed)}`;
    })
    .join(
      "\n\n",
    )}\n\n> Dime *"Agrega un cronómetro para ver cuánto tarda la pizza"*.\n> Usa *${COMMANDS.CRONOMETER} - <índice1> ... <índiceN>* para eliminarlos.`;
}

function cronometerUsage() {
  return `Uso: ${COMMANDS.CRONOMETER} <título> para guardar la hora, ${COMMANDS.CRONOMETER} para listar, o ${COMMANDS.CRONOMETER} - <índice> para eliminar.`;
}

module.exports = { formatCronometers, presentCronometerResult };
