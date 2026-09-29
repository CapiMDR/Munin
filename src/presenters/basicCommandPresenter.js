const { MESSAGES } = require("./messages");
const { formatTimerDuration } = require("../utils/timeUtils");

function getTimerFinishedOutput(chatId) {
  return { type: "text", chatId, text: MESSAGES.TIMER_FINISHED };
}

function presentBasicCommandResult(result, { chatId } = {}) {
  if (!result.ok) return { ok: false, code: result.code, message: getBasicErrorMessage(result.code) };

  switch (result.code) {
    case "BASIC_WELCOME":
      return { ok: true, message: MESSAGES.WELCOME };
    case "BASIC_PING":
      return { ok: true, message: MESSAGES.PONG };
    case "BASIC_ECHO":
      return { ok: true, message: result.data.text };
    case "BASIC_COIN_FLIPPED":
      return { ok: true, message: MESSAGES.COIN_RESULT(result.data.side) };
    case "BASIC_DICE_ROLLED":
      return { ok: true, message: MESSAGES.DICE_RESULT(result.data.value) };
    case "BASIC_EIGHT_BALL_ANSWERED":
      return { ok: true, message: MESSAGES.EIGHT_BALL_RESULT(result.data.answer) };
    case "BASIC_RANDOM_CHOSEN":
      return { ok: true, message: MESSAGES.RANDOM_RESULT(result.data.choice) };
    case "BASIC_POLL_CREATED":
      return {
        ok: true,
        output: { type: "poll", chatId, title: result.data.title, options: result.data.options, allowMultipleAnswers: result.data.allowMultipleAnswers },
      };
    case "BASIC_TIMER_CREATED":
      return {
        ok: true,
        outputs: [
          { type: "schedule", duration: result.data.duration, output: getTimerFinishedOutput(chatId) },
          { type: "text", chatId, text: MESSAGES.TIMER_STARTED(formatTimerDuration(result.data.durationText)) },
        ],
      };
    case "BASIC_WEEKLY_REPORT_TOGGLED":
      return { ok: true, message: result.data.enabled ? MESSAGES.WEEKLY_REPORT_ENABLED : MESSAGES.WEEKLY_REPORT_DISABLED };
    case "BASIC_ANIMAL_IMAGE_REQUESTED":
      return {
        ok: true,
        output: {
          type: "animal_image",
          chatId,
          animal: result.data.animal,
          fallbackText: result.data.animal === "cat" ? MESSAGES.CAT_UNAVAILABLE : MESSAGES.DOG_UNAVAILABLE,
        },
      };
    case "BASIC_COMMAND_SUGGESTED":
      return { ok: true, message: MESSAGES.SUGGEST_SIMILAR_COMMAND(result.data.suggestion) };
    case "BASIC_COMMAND_UNKNOWN":
      return { ok: true, message: MESSAGES.UNKNOWN_COMMAND(result.data.command) };
    default:
      return { ok: false, code: "BASIC_RESULT_UNKNOWN", message: MESSAGES.PONG };
  }
}

function getBasicErrorMessage(code) {
  if (code === "BASIC_RANDOM_INPUT_INVALID") return MESSAGES.RANDOM_USAGE;
  if (code === "BASIC_POLL_INPUT_INVALID") return MESSAGES.POLL_USAGE;
  if (code === "BASIC_TIMER_INPUT_INVALID") return MESSAGES.TIMER_USAGE;
  if (code === "BASIC_ANIMAL_INVALID") return MESSAGES.IMAGE_GENERATION_UNAVAILABLE;
  return MESSAGES.PONG;
}

module.exports = { getTimerFinishedOutput, presentBasicCommandResult };
