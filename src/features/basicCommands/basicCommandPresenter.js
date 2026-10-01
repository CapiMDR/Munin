const { COMMANDS } = require("../../config/commandConstants");
const { formatTimerDuration } = require("../../utils/timeUtils");
const { CAT_UNAVAILABLE, DOG_UNAVAILABLE } = require("../animals/animalImagePresenter");
const { IMAGE_GENERATION_UNAVAILABLE } = require("../images/imageGenerationPresenter");

const COIN_SIDES = Object.freeze(["cara", "cruz"]);
const EIGHT_BALL_RESPONSES = Object.freeze([
  "Sí",
  "No",
  "Tal vez",
  "Definitivamente",
  "Pregunta de nuevo más tarde",
  "No cuentes con ello",
  "Es cierto",
  "No es cierto",
  "No puedo predecirlo ahora",
  "Las perspectivas son buenas",
  "Las perspectivas no son buenas",
  "Sin duda",
  "No lo creo",
  "Sí, definitivamente",
  "Mis fuentes dicen que no",
  "No puedo decirlo ahora",
  "Concéntrate y pregunta de nuevo",
  "Mi respuesta es no",
  "Mi respuesta es sí",
  "Puedes confiar en ello",
]);

function getTimerFinishedOutput(chatId) {
  return { type: "text", chatId, text: "⏰ El tiempo se ha acabado." };
}

function presentBasicCommandResult(result, { chatId } = {}) {
  if (!result.ok) return { ok: false, code: result.code, message: getBasicErrorMessage(result.code) };

  switch (result.code) {
    case "BASIC_WELCOME":
      return {
        ok: true,
        message: `¡Hola! Soy Munin 🐦‍⬛, un bot asistente de WhatsApp creado por Capi. Escribe ${COMMANDS.HELP} para ver los comandos disponibles.`,
      };
    case "BASIC_PING":
      return { ok: true, message: "pong" };
    case "BASIC_ECHO":
      return { ok: true, message: result.data.text };
    case "BASIC_COIN_FLIPPED":
      return { ok: true, message: `🪙 Ha salido ${result.data.side}` };
    case "BASIC_DICE_ROLLED":
      return { ok: true, message: `🎲 Has sacado un ${result.data.value}` };
    case "BASIC_EIGHT_BALL_ANSWERED":
      return { ok: true, message: `🎱 La bola 8 dice: ${result.data.answer}` };
    case "BASIC_RANDOM_CHOSEN":
      return { ok: true, message: `🎲 He elegido: ${result.data.choice}` };
    case "BASIC_POLL_CREATED":
      return {
        ok: true,
        output: {
          type: "poll",
          chatId,
          title: result.data.title,
          options: result.data.options,
          allowMultipleAnswers: result.data.allowMultipleAnswers,
        },
      };
    case "BASIC_TIMER_CREATED":
      return {
        ok: true,
        outputs: [
          { type: "schedule", duration: result.data.duration, output: getTimerFinishedOutput(chatId) },
          { type: "text", chatId, text: `🐦‍⬛ Estaré contando por ${formatTimerDuration(result.data.durationText)}.` },
        ],
      };
    case "BASIC_WEEKLY_REPORT_TOGGLED":
      return {
        ok: true,
        message: result.data.enabled
          ? "Reporte semanal automático activado. Lo enviaré cada domingo a las 18:00."
          : "Reporte semanal automático desactivado.",
      };
    case "BASIC_ANIMAL_IMAGE_REQUESTED":
      return {
        ok: true,
        output: {
          type: "animal_image",
          chatId,
          animal: result.data.animal,
          fallbackText: result.data.animal === "cat" ? CAT_UNAVAILABLE : DOG_UNAVAILABLE,
        },
      };
    case "BASIC_COMMAND_SUGGESTED":
      return { ok: true, message: `Intenta ${result.data.suggestion} o usa !ayuda para ver los comandos disponibles` };
    case "BASIC_COMMAND_UNKNOWN":
      return { ok: true, message: `Comando no reconocido: ${result.data.command}. Escribe ${COMMANDS.HELP} para ver los comandos disponibles.` };
    default:
      return { ok: false, code: "BASIC_RESULT_UNKNOWN", message: "pong" };
  }
}

function getBasicErrorMessage(code) {
  if (code === "BASIC_RANDOM_INPUT_INVALID") return `Uso: ${COMMANDS.RANDOM} <opción1>, <opción2> ... , <opciónN>`;
  if (code === "BASIC_POLL_INPUT_INVALID") return `Uso: ${COMMANDS.POLL} <título>,<opción1>,<opción2>,...,<opciónN>`;
  if (code === "BASIC_TIMER_INPUT_INVALID") return `Uso: ${COMMANDS.TIMER} <cantidad><s/m/h>`;
  if (code === "BASIC_ANIMAL_INVALID") return IMAGE_GENERATION_UNAVAILABLE;
  return "pong";
}

module.exports = { COIN_SIDES, EIGHT_BALL_RESPONSES, getTimerFinishedOutput, presentBasicCommandResult };
