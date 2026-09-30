const { COIN_SIDES, EIGHT_BALL_RESPONSES } = require("../presenters/basicCommandPresenter");
const { parseTimerDuration } = require("../utils/timeUtils");
const { failure, success } = require("./result");

function getWelcome() {
  return success("BASIC_WELCOME");
}

function getPing() {
  return success("BASIC_PING");
}

function echo({ args }) {
  return success("BASIC_ECHO", { text: args.join(" ") });
}

function flipCoin(random = Math.random) {
  return success("BASIC_COIN_FLIPPED", { side: COIN_SIDES[Math.floor(random() * COIN_SIDES.length)] });
}

function rollDice(random = Math.random) {
  return success("BASIC_DICE_ROLLED", { value: Math.floor(random() * 6) + 1 });
}

function askEightBall(random = Math.random) {
  return success("BASIC_EIGHT_BALL_ANSWERED", { answer: EIGHT_BALL_RESPONSES[Math.floor(random() * EIGHT_BALL_RESPONSES.length)] });
}

function chooseRandom({ args }, random = Math.random) {
  const options = parseCommaSeparatedOptions(args);
  if (options.length < 2) return failure("BASIC_RANDOM_INPUT_INVALID");
  return success("BASIC_RANDOM_CHOSEN", { choice: options[Math.floor(random() * options.length)] });
}

function createPoll({ chatId, title, options, allowMultipleAnswers, senderMentionId }, userStatsStore) {
  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  const normalizedOptions = Array.isArray(options)
    ? options.map((option) => (typeof option === "string" ? option.trim() : "")).filter(Boolean)
    : [];
  if (!normalizedTitle || normalizedOptions.length < 2) return failure("BASIC_POLL_INPUT_INVALID");

  userStatsStore?.recordAction(chatId, senderMentionId, "pollsCreated");
  return success("BASIC_POLL_CREATED", { allowMultipleAnswers: allowMultipleAnswers === true, options: normalizedOptions, title: normalizedTitle });
}

function createTimer({ durationText }) {
  const duration = parseTimerDuration(durationText);
  if (!duration) return failure("BASIC_TIMER_INPUT_INVALID");
  return success("BASIC_TIMER_CREATED", { duration, durationText });
}

function toggleWeeklyReport({ chatId }, weeklyReportStore) {
  return success("BASIC_WEEKLY_REPORT_TOGGLED", { enabled: Boolean(weeklyReportStore?.toggle(chatId)) });
}

function requestAnimalImage({ animal }) {
  if (!["cat", "dog"].includes(animal)) return failure("BASIC_ANIMAL_INVALID");
  return success("BASIC_ANIMAL_IMAGE_REQUESTED", { animal });
}

async function resolveUnknownCommand({ command, availableCommands }, suggestSimilarCommand) {
  try {
    const suggestion = await suggestSimilarCommand?.(command.toLowerCase(), availableCommands);
    return suggestion ? success("BASIC_COMMAND_SUGGESTED", { suggestion }) : success("BASIC_COMMAND_UNKNOWN", { command });
  } catch (error) {
    console.warn("Could not suggest a similar command:", error.message);
    return success("BASIC_COMMAND_UNKNOWN", { command });
  }
}

function parseCommaSeparatedOptions(args) {
  return args
    .join(" ")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  askEightBall,
  chooseRandom,
  createPoll,
  createTimer,
  echo,
  flipCoin,
  getPing,
  getWelcome,
  requestAnimalImage,
  resolveUnknownCommand,
  rollDice,
  toggleWeeklyReport,
};
