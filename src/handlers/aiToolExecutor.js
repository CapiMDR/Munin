const { parsePendingDate, parsePendingTime } = require("../utils/pendingUtils");
const { formatTimerDuration, parseTimerDuration } = require("../utils/timeUtils");
const { COMMANDS } = require("../config/commandConstants");
const { MESSAGES } = require("../presenters/messages");
const { formatAllClasses, formatClassesToday } = require("../presenters/classPresenter");
const { getMexicoCityTime } = require("../utils/timeUtils");
const pendingService = require("../services/pendingService");
const reminderService = require("../services/reminderService");
const savedMessageService = require("../services/savedMessageService");
const { presentPendingResult } = require("../presenters/pendingPresenter");
const { presentSavedMessageResult } = require("../presenters/savedMessagePresenter");
const { presentReminderResult } = require("../presenters/reminderPresenter");
const { presentClassResult } = require("../presenters/classPresenter");
const customCommandService = require("../services/customCommandService");
const { presentCustomCommandResult } = require("../presenters/customCommandPresenter");
const { presentWeatherResult } = require("../presenters/weatherPresenter");
const { presentTriviaResult } = require("../presenters/triviaPresenter");
const statsService = require("../services/statsService");
const { presentStatsResult } = require("../presenters/statsPresenter");
const helpService = require("../services/helpService");
const { presentHelpResult } = require("../presenters/helpPresenter");
const animalImageService = require("../services/animalImageService");
const { presentAnimalImageResult } = require("../presenters/animalImagePresenter");
const summaryService = require("../services/summaryService");
const { presentSummaryResult } = require("../presenters/summaryPresenter");
const classService = require("../services/classService");
const triviaService = require("../services/triviaService");
const weatherService = require("../services/weatherService");

// This factory receives the application dependencies once at startup. Each tool
// execution then receives only request-specific context such as chatId/message.
function createAiToolExecutor({
  pendingStore,
  reminderStore,
  reminderScheduler,
  savedMessageStore,
  customCommandStore,
  userStatsStore,
  sendAnimalImage,
  sendGeneratedImage,
  reactToInvokingMessage,
  openMeteoApi,
  openTriviaApi,
  translateTrivia,
  triviaManager,
  classStore,
  classScheduler,
  scheduleTimer,
  sendMessage,
  summarizer,
}) {
  const handlers = {
    save_message: (args, context) => saveMessage(args, context, savedMessageStore, userStatsStore),
    view_saved_message: (args, context) => viewSavedMessage(args, context, savedMessageStore, sendMessage),
    list_saved_messages: (args, context) => listSavedMessages(context, savedMessageStore),
    create_pending: (args, context) => createPending(args, context, pendingStore),
    list_pendings: (args, context) => listPendings(context, pendingStore),
    delete_pending: (args, context) => deletePending(args, context, pendingStore),
    create_reminder: (args, context) => createReminder(args, context, reminderStore, reminderScheduler, userStatsStore),
    list_reminders: (args, context) => listReminders(context, reminderStore),
    delete_reminder: (args, context) => deleteReminder(args, context, reminderStore, reminderScheduler),
    start_timer: (args, context) => startTimer(args, context, scheduleTimer, sendMessage),
    summarize_messages: (args, context) => summarizeMessages(args, context, summarizer),
    show_help: (args) => showHelp(args),
    create_custom_command: (args, context) => createCustomCommand(args, context, customCommandStore),
    show_user_stats: (args, context) => showUserStats(context, userStatsStore),
    send_animal_image: (args, context) => sendRandomImageForGroup(context, sendAnimalImage, args.animal),
    generate_image: (args, context) => generateImageForGroup(args, context, sendGeneratedImage, reactToInvokingMessage),
    react_to_message: (args, context) => reactToInvokingMessageTool(args, context, reactToInvokingMessage),
    get_weather: (args) => getWeather(args, openMeteoApi),
    start_trivia: (args, context) => startTrivia(args, context, openTriviaApi, translateTrivia, triviaManager),
    list_classes: (args, context) => listClasses(context, classStore),
    list_classes_today: (args, context) => listClassesToday(context, classStore),
    add_class: (args, context) => addClass(args, context, classStore, classScheduler),
    edit_class: (args, context) => editClass(args, context, classStore, classScheduler),
    delete_class: (args, context) => deleteClass(args, context, classStore, classScheduler),
    set_class_bell: (args, context) => setClassBell(args, context, classStore, classScheduler),
  };

  // Flow: Groq tool call -> JSON validation -> named handler -> structured result
  // -> muninAI sends the result back to Groq for a user-facing final response.
  async function execute(toolCall, context) {
    const args = parseToolArguments(toolCall);
    if (args.error) return args;

    const handler = handlers[toolCall.function.name];
    if (!handler) return failure(`Unknown tool: ${toolCall.function.name}`);

    console.log(`Tool call: ${toolCall.function.name}`, args);
    return handler(args, context);
  }

  return { execute };
}

function parseToolArguments(toolCall) {
  try {
    return JSON.parse(toolCall.function.arguments || "{}");
  } catch {
    return failure("The tool arguments were invalid.");
  }
}

function saveMessage(args, context, savedMessageStore, userStatsStore) {
  const title = args.title?.trim();
  if (!title) return failure("A title is required.");
  if (!context.message.hasQuotedMsg) {
    return failure("The user did not reply to a message. Tell them they must reply to the message they want to save.");
  }
  const savedMessage = savedMessageService.saveMessage(
    {
      chatId: context.chatId,
      title,
      quotedStanzaId: context.message._data?.quotedStanzaID,
      quotedParticipant: context.message._data?.quotedParticipant,
      botLid: context.botLid,
      senderMentionId: context.sender?.mentionId,
    },
    savedMessageStore,
    userStatsStore,
  );
  const presentation = presentSavedMessageResult(savedMessage, { title });
  return presentation.ok
    ? { success: true, action: presentation.action, updated: savedMessage.data.updated, message: presentation.message }
    : failure(presentation.code, presentation.message);
}

async function viewSavedMessage(args, context, savedMessageStore, sendMessage) {
  const title = args.title?.trim();
  if (!title) return failure("A title is required.");

  const result = savedMessageService.getSavedMessage(context.chatId, title, savedMessageStore);
  const presentation = presentSavedMessageResult(result, { title });
  if (!presentation.ok) return failure(presentation.code, presentation.message);
  await sendMessage(context.chatId, presentation.message, presentation.sendOptions);
  return { success: true, action: presentation.action, title, messageWasShown: true };
}

function listSavedMessages(context, savedMessageStore) {
  const result = savedMessageService.listSavedMessages(context.chatId, savedMessageStore);
  const presentation = presentSavedMessageResult(result);
  return { success: true, action: presentation.action, message: presentation.message };
}

function createPending(args, context, pendingStore) {
  const content = args.content?.trim();
  const date = args.date === undefined ? undefined : parsePendingDate(`@${args.date}`);
  const time = args.time === undefined ? undefined : parsePendingTime(args.time);
  if (!content) return failure("Pending content is required.");
  if (args.date !== undefined && !date) return failure("The pending date must use a real dd/mm date.");
  if (args.time !== undefined && !time) return failure("The pending time must use HH:mm.", MESSAGES.PENDING_USAGE);

  const pendingResult = pendingService.createPending({ chatId: context.chatId, content, date, time }, pendingStore);
  const presentation = presentPendingResult(pendingResult);
  return presentation.ok
    ? { success: true, action: presentation.action, content, date: date || null, time: time || null, message: presentation.message }
    : failure(presentation.code, presentation.message);
}

function listPendings(context, pendingStore) {
  const result = pendingService.listPendings(context.chatId, pendingStore);
  const presentation = presentPendingResult(result);
  return { success: true, action: presentation.action, message: presentation.message };
}

function deletePending(args, context, pendingStore) {
  if (!isOneBasedIndex(args.index)) return failure("A positive pending index is required.");
  const pendingResult = pendingService.deletePending(context.chatId, args.index - 1, pendingStore);
  const presentation = presentPendingResult(pendingResult, { index: args.index });
  return presentation.ok
    ? { success: true, action: presentation.action, index: args.index, message: presentation.message }
    : failure(presentation.code, presentation.message);
}

function createReminder(args, context, reminderStore, reminderScheduler, userStatsStore) {
  const result = reminderService.createReminder(
    {
      chatId: context.chatId,
      text: args.content,
      duration: args.duration,
      dueDate: args.due_date,
      dueTime: args.due_time,
      repeatCount: args.repeat_count,
      repeatForever: args.repeat_forever === true,
      weeklyRecurrence: args.weekly_recurrence,
      messageId: context.messageId,
      senderMentionId: context.sender?.mentionId,
    },
    reminderStore,
    reminderScheduler,
    userStatsStore,
  );
  const presentation = presentReminderResult(result, { duration: args.duration });
  if (!presentation.ok) return failure(presentation.code, presentation.message);
  return {
    success: true,
    action: presentation.action,
    content: result.data.reminder.text,
    dueAt: presentation.dueAt,
    timeZone: "America/Mexico_City",
    absolute: result.data.kind === "absolute",
    recurring: result.data.kind !== "absolute" && result.data.kind !== "relative",
    repetitions: result.data.count === null ? "infinite" : (result.data.count ?? null),
    message: presentation.message,
  };
}

function listReminders(context, reminderStore) {
  const presentation = presentReminderResult(reminderService.listReminders(context.chatId, reminderStore));
  return { success: true, action: presentation.action, message: presentation.message };
}

function deleteReminder(args, context, reminderStore, reminderScheduler) {
  if (!isOneBasedIndex(args.index)) return failure("A positive reminder index is required.");
  const result = reminderService.deleteReminder(context.chatId, args.index - 1, reminderStore, reminderScheduler);
  const presentation = presentReminderResult(result, { index: args.index });
  return presentation.ok
    ? { success: true, action: presentation.action, index: args.index, message: presentation.message }
    : failure(presentation.code, presentation.message);
}

function startTimer(args, context, scheduleTimer, sendMessage) {
  const duration = parseTimerDuration(args.duration);
  if (!duration) return failure("A valid timer duration using s, m, or h is required.");
  if (!scheduleTimer) return failure("The timer scheduler is unavailable.");

  // Timers are intentionally not persisted, matching the existing !tiempo behavior.
  scheduleTimer(duration, () => sendMessage(context.chatId, MESSAGES.TIMER_FINISHED));
  return { success: true, action: "start_timer", duration: formatTimerDuration(args.duration) };
}

function showHelp(args) {
  const presentation = presentHelpResult(helpService.getHelp({ page: args.page }));
  return presentation.ok ? { success: true, action: presentation.action, help: presentation.help } : failure(presentation.code, presentation.message);
}

// Mirrors !comando: members may create or update their group's fixed-reply
// commands, except for names reserved by Munin's built-in command handlers.
function createCustomCommand(args, context, customCommandStore) {
  const result = customCommandService.createCustomCommand(
    { chatId: context.chatId, command: args.command, reply: args.reply, builtInCommands: Object.values(COMMANDS) },
    customCommandStore,
  );
  const presentation = presentCustomCommandResult(result);
  return presentation.ok
    ? { success: true, action: presentation.action, message: presentation.message }
    : failure(presentation.code, presentation.message);
}

function showUserStats(context, userStatsStore) {
  const presentation = presentStatsResult(
    statsService.getUserStats({ chatId: context.chatId, mentionId: context.sender?.mentionId }, userStatsStore),
  );
  return presentation.ok
    ? { success: true, action: presentation.action, message: presentation.message }
    : failure(presentation.code, presentation.message);
}

async function sendRandomImageForGroup(context, sendAnimalImage, animal) {
  const presentation = presentAnimalImageResult(
    await animalImageService.sendAnimalImage({ chatId: context.chatId, animal }, sendAnimalImage),
    animal,
  );
  return presentation.ok
    ? { success: true, action: presentation.action, imageId: presentation.imageId, imageWasSent: true }
    : failure(presentation.code, presentation.message);
}

async function generateImageForGroup(args, context, sendGeneratedImage, reactToInvokingMessage) {
  const prompt = typeof args.prompt === "string" ? args.prompt.trim() : "";
  if (!prompt || prompt.length > 2_048) return failure("A valid image prompt is required.", MESSAGES.IMAGE_GENERATION_UNAVAILABLE);
  if (typeof sendGeneratedImage !== "function") return failure("Image generation is unavailable.", MESSAGES.IMAGE_GENERATION_UNAVAILABLE);

  try {
    if (typeof reactToInvokingMessage === "function") {
      try {
        await reactToInvokingMessage(context.message, "🐦‍⬛");
      } catch (error) {
        console.warn("Could not react before generating image:", error.message);
      }
    }
    await sendGeneratedImage(context.chatId, prompt);
    return { success: true, action: "generate_image", imageWasSent: true };
  } catch (error) {
    console.error("Could not generate image:", error.message);
    return failure("Could not generate image.", MESSAGES.IMAGE_GENERATION_UNAVAILABLE);
  }
}

async function getWeather(args, openMeteoApi) {
  const result = await weatherService.getWeather({ date: args.date, location: args.location }, openMeteoApi);
  const presentation = presentWeatherResult(result);
  return presentation.ok
    ? { success: true, action: presentation.action, message: presentation.message }
    : failure(presentation.code, presentation.message);
}

async function reactToInvokingMessageTool(args, context, reactToInvokingMessage) {
  const emoji = typeof args.emoji === "string" ? args.emoji.trim() : "";
  if (!emoji || emoji.includes("🪶") || !/\p{Extended_Pictographic}/u.test(emoji)) return failure("A non-feather emoji reaction is required.");
  if (typeof reactToInvokingMessage !== "function") return failure("Message reactions are unavailable.");

  try {
    await reactToInvokingMessage(context.message, emoji);
    return { success: true, action: "react_to_message" };
  } catch (error) {
    console.error("Could not react to invoking message:", error.message);
    return failure("Could not react to the message.");
  }
}

async function startTrivia(args, context, openTriviaApi, translateTrivia, triviaManager) {
  const result = await triviaService.startTrivia({ chatId: context.chatId, amount: args.amount }, { openTriviaApi, translateTrivia, triviaManager });
  const presentation = presentTriviaResult(result);
  return presentation.ok ? { success: true, action: presentation.action } : failure(presentation.code, presentation.message);
}

function listClasses(context, classStore) {
  if (!classStore) return failure("The class store is unavailable.");

  return {
    success: true,
    action: "list_classes",
    message: formatAllClassesForChat(classStore, context.chatId),
  };
}

function summarizeMessages(args, context, summarizer) {
  const presentation = presentSummaryResult(
    summaryService.prepareSummary({ chatId: context.chatId, amount: args.amount, excludedMessage: context.message }, summarizer),
  );
  return presentation.ok
    ? { success: true, action: presentation.action, amount: presentation.amount, conversation: presentation.conversation }
    : failure(presentation.code, presentation.message);
}

function listClassesToday(context, classStore) {
  if (!classStore) return failure("The class store is unavailable.");

  const day = getMexicoCityTime().day;
  return {
    success: true,
    action: "list_classes_today",
    message: formatClassesToday(day, classStore.getByDay(context.chatId, day), undefined, getBellState(classStore, context.chatId)),
  };
}

function addClass(args, context, classStore, classScheduler) {
  if (!classStore) return failure("The class store is unavailable.");
  const result = classService.addClass(
    { chatId: context.chatId, name: args.name, day: args.day, timeRange: args.time_range, classroom: args.classroom },
    classStore,
    classScheduler,
  );
  const presentation = presentClassResult(result);
  return presentation.ok
    ? { success: true, action: presentation.action, message: presentation.message }
    : failure(presentation.code, presentation.message);
}

function editClass(args, context, classStore, classScheduler) {
  if (!classStore) return failure("The class store is unavailable.");
  const result = classService.updateClass(
    {
      chatId: context.chatId,
      reference: args.index,
      updates: { name: args.name, day: args.day, timeRange: args.time_range, classroom: args.classroom },
    },
    classStore,
    classScheduler,
  );
  const presentation = presentClassResult(result);
  return presentation.ok
    ? { success: true, action: presentation.action, message: presentation.message }
    : failure(presentation.code, presentation.message);
}

function deleteClass(args, context, classStore, classScheduler) {
  if (!classStore) return failure("The class store is unavailable.");
  const result = classService.deleteClass({ chatId: context.chatId, index: args.index }, classStore, classScheduler);
  const presentation = presentClassResult(result);
  return presentation.ok
    ? { success: true, action: presentation.action, message: presentation.message }
    : failure(presentation.code, presentation.message);
}

function setClassBell(args, context, classStore, classScheduler) {
  if (!classStore) return failure("The class store is unavailable.");
  const result = classService.setBell({ chatId: context.chatId, enabled: args.enabled }, classStore, classScheduler);
  const presentation = presentClassResult(result);
  return presentation.ok
    ? { success: true, action: presentation.action, message: presentation.message }
    : failure(presentation.code, presentation.message);
}

function formatClass(classData) {
  return {
    index: classData.globalIndex,
    name: classData.name,
    day: classData.day,
    startTime: classData.startTime,
    endTime: classData.endTime,
    classroom: classData.classroom,
  };
}

function formatAllClassesForChat(classStore, chatId) {
  return formatAllClasses(classStore.getAllSorted(chatId), undefined, getBellState(classStore, chatId));
}

function getBellState(classStore, chatId) {
  return classStore.getBell?.(chatId);
}

function isOneBasedIndex(value) {
  return Number.isInteger(value) && value > 0;
}

function failure(error, userMessage) {
  return { success: false, error, userMessage };
}

module.exports = { createAiToolExecutor };
