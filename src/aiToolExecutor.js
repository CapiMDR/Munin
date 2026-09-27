const { getPendingContent, parsePendingDate, parsePendingTime } = require("./pendingUtils");
const {
  formatMexicoCityDateTime,
  formatDuration,
  formatTimerDuration,
  getMexicoCityDateParts,
  mexicoCityDateTimeToTimestamp,
  parseClockTime,
  parseDuration,
  parseTimeRange,
  parseTimerDuration,
} = require("./timeUtils");
const { DAYS_ORDER, capitalize } = require("./classStore");
const { COMMANDS, MESSAGES } = require("./commandConstants");
const { formatAllClasses, formatClassesToday, formatPendings, formatReminders, formatSavedMessages } = require("./listResponseFormatter");
const { getMexicoCityTime } = require("./timeUtils");
const { resolveMexicoCityDate } = require("./dateUtils");
const { WEEKDAYS, getNextWeeklyTrigger, parseTime, toIso } = require("./reminderSchedule");

const MINIMUM_RECURRING_REMINDER_MS = 10 * 60_000;

// This factory receives the application dependencies once at startup. Each tool
// execution then receives only request-specific context such as chatId/message.
function createAiToolExecutor({
  pendingStore,
  reminderStore,
  reminderScheduler,
  savedMessageStore,
  customCommandStore,
  userStatsStore,
  sendCatImage,
  sendDogImage,
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
    send_cat_image: (args, context) => sendRandomImageForGroup(context, sendCatImage, "send_cat_image", MESSAGES.CAT_UNAVAILABLE),
    send_dog_image: (args, context) => sendRandomImageForGroup(context, sendDogImage, "send_dog_image", MESSAGES.DOG_UNAVAILABLE),
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
  const quotedStanzaId = context.message._data?.quotedStanzaID;
  const quotedParticipant = context.message._data?.quotedParticipant;

  if (!title) return failure("A title is required.");
  if (!context.message.hasQuotedMsg || !quotedStanzaId || !quotedParticipant) {
    return failure("The user did not reply to a message. Tell them they must reply to the message they want to save.");
  }

  const quotedMessageId = `false_${context.chatId}_${quotedStanzaId}_${quotedParticipant}`;
  const updated = savedMessageStore.set(context.chatId, title, quotedMessageId);
  userStatsStore?.recordAction(context.chatId, context.sender?.mentionId, "messagesSaved");
  return { success: true, action: "save_message", title, updated };
}

async function viewSavedMessage(args, context, savedMessageStore, sendMessage) {
  const title = args.title?.trim();
  if (!title) return failure("A title is required.");

  const savedMessage = savedMessageStore.get(context.chatId, title);
  if (!savedMessage) return failure(`There is no saved message titled "${title}".`);

  await sendMessage(context.chatId, `Mensaje guardado: ${savedMessage.title}`, { quotedMessageId: savedMessage.messageId });
  return { success: true, action: "view_saved_message", title: savedMessage.title, messageWasShown: true };
}

function listSavedMessages(context, savedMessageStore) {
  const savedMessages = savedMessageStore.getAll(context.chatId);
  return { success: true, action: "list_saved_messages", message: formatSavedMessages(savedMessages) };
}

function createPending(args, context, pendingStore) {
  const content = args.content?.trim();
  const date = args.date === undefined ? undefined : parsePendingDate(`@${args.date}`);
  const time = args.time === undefined ? undefined : parsePendingTime(args.time);
  if (!content) return failure("Pending content is required.");
  if (args.date !== undefined && !date) return failure("The pending date must use a real dd/mm date.");
  if (args.time !== undefined && !time) return failure("The pending time must use HH:mm.", MESSAGES.PENDING_USAGE);

  pendingStore.add(context.chatId, content, date, time);
  return {
    success: true,
    action: "create_pending",
    content,
    date: date || null,
    time: time || null,
    message: MESSAGES.MUTATION_WITH_LIST(MESSAGES.PENDING_ADDED(content, date, time), formatPendings(pendingStore.getAll(context.chatId))),
  };
}

function listPendings(context, pendingStore) {
  const pendings = pendingStore.getAll(context.chatId);
  return { success: true, action: "list_pendings", message: formatPendings(pendings) };
}

function deletePending(args, context, pendingStore) {
  if (!isOneBasedIndex(args.index)) return failure("A positive pending index is required.");
  const pending = pendingStore.remove(context.chatId, args.index - 1);
  if (!pending) return failure(`There is no pending item at index ${args.index}.`);
  return {
    success: true,
    action: "delete_pending",
    index: args.index,
    content: getPendingContent(pending),
    message: MESSAGES.MUTATION_WITH_LIST(MESSAGES.PENDING_DELETED(args.index, getPendingContent(pending)), formatPendings(pendingStore.getAll(context.chatId))),
  };
}

function createReminder(args, context, reminderStore, reminderScheduler, userStatsStore) {
  const content = args.content?.trim();
  const hasDuration = args.duration !== undefined;
  const hasAbsoluteTime = args.due_date !== undefined || args.due_time !== undefined;
  const hasRepeatCount = args.repeat_count !== undefined;
  const repeatForever = args.repeat_forever === true;
  const weeklyRecurrence = args.weekly_recurrence;

  if (!content) return failure("Reminder content is required.");
  if (weeklyRecurrence) return createWeeklyReminder(args, context, reminderStore, reminderScheduler, userStatsStore);
  if (hasDuration && hasAbsoluteTime) return failure("Use either duration or due_date/due_time, not both.");
  if (!hasDuration && !hasAbsoluteTime) return failure("A reminder time is required.", MESSAGES.REMINDER_INVALID_DURATION);
  if (repeatForever && hasRepeatCount) return failure("Use either repeat_count or repeat_forever, not both.");

  let duration;
  let dueAt;
  if (hasAbsoluteTime) {
    if (hasRepeatCount || repeatForever) return failure("Absolute reminders cannot repeat.");
    const absoluteDueAt = getAbsoluteReminderDueAt(args);
    if (absoluteDueAt.error) return absoluteDueAt;
    dueAt = absoluteDueAt.dueAt;
  } else {
    duration = parseDuration(args.duration);
    if (!duration) return failure("A valid reminder duration is required.", MESSAGES.REMINDER_INVALID_DURATION);
    dueAt = Date.now() + duration;
  }

  const remaining = hasRepeatCount ? Number(args.repeat_count) : undefined;
  if (hasRepeatCount && (!Number.isInteger(remaining) || remaining < 1)) return failure("repeat_count must be a positive integer.");
  if ((hasRepeatCount || repeatForever) && duration < MINIMUM_RECURRING_REMINDER_MS) return failure("Recurring reminders require a minimum duration of 10m.");

  const reminder = hasRepeatCount || repeatForever
    ? reminderStore.addRecurring(context.chatId, content, dueAt, duration, repeatForever ? null : remaining, context.messageId)
    : reminderStore.add(context.chatId, content, dueAt, context.messageId);
  userStatsStore?.recordAction(context.chatId, context.sender?.mentionId, "remindersCreated");

  reminderScheduler.schedule({ chatId: context.chatId, ...reminder });
  const confirmation = hasRepeatCount || repeatForever
    ? MESSAGES.RECURRING_REMINDER_ADDED(formatDuration(args.duration), repeatForever ? "infinitas veces" : `${remaining} veces`, content)
    : MESSAGES.REMINDER_CREATED(content, formatMexicoCityDateTime(dueAt));

  return {
    success: true,
    action: "create_reminder",
    content,
    dueAt: formatMexicoCityDateTime(dueAt),
    timeZone: "America/Mexico_City",
    absolute: hasAbsoluteTime,
    recurring: hasRepeatCount || repeatForever,
    repetitions: repeatForever ? "infinite" : remaining || null,
    message: MESSAGES.MUTATION_WITH_LIST(confirmation, formatReminders(reminderStore.getAll(context.chatId))),
  };
}

function listReminders(context, reminderStore) {
  const reminders = reminderStore.getAll(context.chatId);
  return { success: true, action: "list_reminders", message: formatReminders(reminders) };
}

function deleteReminder(args, context, reminderStore, reminderScheduler) {
  if (!isOneBasedIndex(args.index)) return failure("A positive reminder index is required.");
  const reminder = reminderStore.remove(context.chatId, args.index - 1);
  if (!reminder) return failure(`There is no reminder at index ${args.index}.`);
  reminderScheduler.cancel(reminder.id);
  return {
    success: true,
    action: "delete_reminder",
    index: args.index,
    content: reminder.text,
    message: MESSAGES.MUTATION_WITH_LIST(MESSAGES.REMINDER_DELETED(args.index, reminder.text), formatReminders(reminderStore.getAll(context.chatId))),
  };
}

function createWeeklyReminder(args, context, reminderStore, reminderScheduler, userStatsStore) {
  const content = args.content?.trim();
  const weekly = args.weekly_recurrence;
  if (args.duration !== undefined || args.due_date !== undefined || args.due_time !== undefined || args.repeat_count !== undefined || args.repeat_forever === true) {
    return failure("Weekly calendar reminders cannot be combined with relative or absolute reminder fields.");
  }
  if (!weekly || typeof weekly !== "object" || Array.isArray(weekly)) return failure("A weekly recurrence is required.");

  const interval = weekly.interval === undefined ? 1 : Number(weekly.interval);
  const daysOfWeek = Array.isArray(weekly.days_of_week) ? [...new Set(weekly.days_of_week.map((day) => String(day).toLowerCase()))] : [];
  const time = typeof weekly.time === "string" ? weekly.time : "";
  const count = weekly.count === undefined ? null : Number(weekly.count);
  if (!content || !Number.isInteger(interval) || interval < 1 || !daysOfWeek.length || !daysOfWeek.every((day) => WEEKDAYS.includes(day)) || !parseTime(time)) {
    return failure("Weekly reminders need valid weekdays, a HH:mm time, and a positive week interval.", MESSAGES.REMINDER_INVALID_ABSOLUTE_TIME);
  }
  if (count !== null && (!Number.isInteger(count) || count < 1)) return failure("A weekly reminder count must be a positive integer.");

  const startDate = weekly.start_date === undefined ? getMexicoCityDateParts() : resolveMexicoCityDate(weekly.start_date);
  const untilDate = weekly.until_date === undefined ? undefined : resolveMexicoCityDate(weekly.until_date);
  if (!startDate || (weekly.until_date !== undefined && !untilDate)) return failure("Weekly reminder dates must be valid.", MESSAGES.REMINDER_INVALID_ABSOLUTE_TIME);

  const recurrence = {
    frequency: "week",
    interval,
    daysOfWeek,
    dayOfMonth: null,
    time,
    until: untilDate ? toIso(mexicoCityDateTimeToTimestamp({ ...untilDate, ...parseTime(time) })) : null,
    count,
  };
  const startBoundary = mexicoCityDateTimeToTimestamp({ ...startDate, hour: 0, minute: 0 });
  // The first matching weekday starts the recurrence cycle. Subsequent
  // occurrences then honor the requested every-N-weeks cadence.
  const firstTrigger = getNextWeeklyTrigger(
    { startAt: toIso(startBoundary), recurrence: { ...recurrence, interval: 1 } },
    startBoundary - 1,
  );
  if (!firstTrigger) return failure("The weekly reminder has no occurrence before its end date.", MESSAGES.REMINDER_TIME_ALREADY_PASSED);

  const reminder = reminderStore.addWeekly(context.chatId, content, firstTrigger, recurrence, context.messageId);
  userStatsStore?.recordAction(context.chatId, context.sender?.mentionId, "remindersCreated");
  reminderScheduler.schedule({ chatId: context.chatId, ...reminder });

  return {
    success: true,
    action: "create_reminder",
    content,
    dueAt: formatMexicoCityDateTime(firstTrigger),
    timeZone: "America/Mexico_City",
    recurring: true,
    message: MESSAGES.MUTATION_WITH_LIST(MESSAGES.REMINDER_CREATED(content, formatMexicoCityDateTime(firstTrigger)), formatReminders(reminderStore.getAll(context.chatId))),
  };
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
  const page = args.page === undefined ? 1 : args.page;
  const helpPage = Number.isInteger(page) ? MESSAGES.HELP_PAGE(page) : undefined;

  if (!helpPage) return failure(MESSAGES.HELP_PAGE_USAGE);
  return { success: true, action: "show_help", page, help: helpPage };
}

// Mirrors !comando: members may create or update their group's fixed-reply
// commands, except for names reserved by Munin's built-in command handlers.
function createCustomCommand(args, context, customCommandStore) {
  const command = typeof args.command === "string" ? args.command.trim().toLowerCase() : "";
  const reply = typeof args.reply === "string" ? args.reply.trim() : "";

  if (!command || !/^![a-z0-9_-]+$/i.test(command) || !reply) {
    return failure("A valid command name and reply are required.", MESSAGES.CUSTOM_COMMAND_USAGE);
  }
  if (Object.values(COMMANDS).includes(command)) {
    return failure(`The command ${command} is built in.`, MESSAGES.CUSTOM_COMMAND_BUILTIN_CONFLICT(command));
  }

  const updated = customCommandStore.set(context.chatId, command, reply);
  return {
    success: true,
    action: "create_custom_command",
    command,
    updated,
    message: updated ? MESSAGES.CUSTOM_COMMAND_UPDATED(command) : MESSAGES.CUSTOM_COMMAND_CREATED(command, reply),
  };
}

function showUserStats(context, userStatsStore) {
  const stats = userStatsStore?.get(context.chatId, context.sender?.mentionId);
  if (!stats) return failure("No statistics are available for this user.", MESSAGES.STATS_UNAVAILABLE);

  return { success: true, action: "show_user_stats", message: MESSAGES.USER_STATS(stats) };
}

async function sendRandomImageForGroup(context, sendImage, action, unavailableMessage) {
  if (!sendImage) return failure("The animal image service is unavailable.", unavailableMessage);

  try {
    const image = await sendImage(context.chatId);
    return { success: true, action, imageId: image.id, imageWasSent: true };
  } catch (error) {
    console.error(`Could not send ${action}:`, error.message);
    return failure("The animal image service failed.", unavailableMessage);
  }
}

async function getWeather(args, openMeteoApi) {
  try {
    const weather = await openMeteoApi?.getWeather(args.date, args.location);
    if (!weather) return failure("The weather service is unavailable.", MESSAGES.WEATHER_UNAVAILABLE);
    return { success: true, action: "get_weather", message: MESSAGES.WEATHER_REPORT(weather) };
  } catch (error) {
    console.error("Could not fetch weather:", error.message);
    return failure("The weather service failed.", error.message === "Invalid weather date." ? MESSAGES.WEATHER_USAGE : MESSAGES.WEATHER_UNAVAILABLE);
  }
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
  try {
    if (triviaManager?.hasActiveSession(context.chatId)) {
      await triviaManager.rejectNewSession(context.chatId);
      return { success: true, action: "start_trivia" };
    }
    const triviaBatch = await openTriviaApi?.getTrivia(args.amount);
    const trivia = await translateTrivia?.(triviaBatch);
    if (!trivia) return failure("The trivia service is unavailable.", MESSAGES.TRIVIA_UNAVAILABLE);
    await triviaManager?.start(context.chatId, trivia);
    return { success: true, action: "start_trivia" };
  } catch (error) {
    console.error("Could not fetch trivia:", error.message);
    return failure("The trivia service failed.", MESSAGES.TRIVIA_UNAVAILABLE);
  }
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
  const maxAmount = summarizer?.maxAmount;
  const amount = args.amount;
  if (!Number.isInteger(maxAmount) || !Number.isInteger(amount) || amount < 1 || amount > maxAmount) {
    return failure("A valid summary amount is required.", MESSAGES.SUMMARY_USAGE(maxAmount));
  }

  // The buffer converts WhatsApp message objects into only "user: content"
  // lines before this result is passed back to the LLM.
  const conversation = summarizer.formatRecentMessages(context.chatId, amount, context.message);
  if (!conversation) return failure("There are no messages to summarize.", MESSAGES.SUMMARY_NO_MESSAGES);

  return { success: true, action: "summarize_messages", amount, conversation };
}

function getAbsoluteReminderDueAt(args) {
  const date = resolveMexicoCityDate(args.due_date);
  const clockTime = parseClockTime(args.due_time);
  if (!clockTime || !date) {
    return failure("A valid absolute reminder date and time are required.", MESSAGES.REMINDER_INVALID_ABSOLUTE_TIME);
  }

  const dueAt = mexicoCityDateTimeToTimestamp({ ...date, ...clockTime });
  if (dueAt <= Date.now()) {
    return failure("The requested reminder time has already passed.", MESSAGES.REMINDER_TIME_ALREADY_PASSED);
  }

  return { dueAt };
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

  const classData = validateNewClass(args);
  if (classData.error) return classData;

  const added = classStore.add(context.chatId, classData);
  rescheduleClasses(classScheduler, context.chatId);
  return classSuccess("add_class", added, context.chatId, classStore);
}

function editClass(args, context, classStore, classScheduler) {
  if (!classStore) return failure("The class store is unavailable.");
  if (!isOneBasedIndex(args.index)) return failure("A positive class index is required.");

  const existing = classStore.getByGlobalIndex(context.chatId, args.index);
  if (!existing) return failure(`There is no class at index ${args.index}.`);

  const updates = validateClassUpdates(args);
  if (updates.error) return updates;

  const updated = classStore.update(context.chatId, existing.id, updates);
  rescheduleClasses(classScheduler, context.chatId);
  return classSuccess("edit_class", updated, context.chatId, classStore);
}

function deleteClass(args, context, classStore, classScheduler) {
  if (!classStore) return failure("The class store is unavailable.");
  if (!isOneBasedIndex(args.index)) return failure("A positive class index is required.");

  const existing = classStore.getByGlobalIndex(context.chatId, args.index);
  if (!existing) return failure(`There is no class at index ${args.index}.`);

  classStore.remove(context.chatId, existing.id);
  rescheduleClasses(classScheduler, context.chatId);
  return {
    success: true,
    action: "delete_class",
    class: formatClass(existing),
    message: MESSAGES.MUTATION_WITH_LIST(MESSAGES.CLASS_DELETED(existing.name), formatAllClassesForChat(classStore, context.chatId)),
  };
}

function setClassBell(args, context, classStore, classScheduler) {
  if (!classStore) return failure("The class store is unavailable.");
  if (typeof args.enabled !== "boolean") return failure("The bell state must be true or false.");

  const enabled = classStore.setBell(context.chatId, args.enabled);
  rescheduleClasses(classScheduler, context.chatId);
  return {
    success: true,
    action: "set_class_bell",
    enabled,
    message: MESSAGES.MUTATION_WITH_LIST(enabled ? MESSAGES.BELL_ON : MESSAGES.BELL_OFF, formatAllClassesForChat(classStore, context.chatId)),
  };
}

function validateNewClass(args) {
  const name = args.name?.trim();
  const day = args.day?.trim().toLowerCase();
  const classroom = args.classroom?.trim();
  const timeRange = typeof args.time_range === "string" ? parseTimeRange(args.time_range.trim()) : undefined;

  if (!name || !day || !classroom || !timeRange) {
    return failure("A class needs a name, valid Spanish weekday, HH:mm-HH:mm time range, and classroom.");
  }
  if (!DAYS_ORDER.includes(day)) return failure("The class day must be a valid Spanish weekday.");

  return { name, day, classroom, ...timeRange };
}

function validateClassUpdates(args) {
  const updates = {};
  const editableFields = ["name", "day", "time_range", "classroom"];
  if (!editableFields.some((field) => args[field] !== undefined)) {
    return failure("Provide at least one class field to update.");
  }

  if (args.name !== undefined) {
    const name = typeof args.name === "string" ? args.name.trim() : "";
    if (!name) return failure("The class name cannot be empty.");
    updates.name = name;
  }
  if (args.classroom !== undefined) {
    const classroom = typeof args.classroom === "string" ? args.classroom.trim() : "";
    if (!classroom) return failure("The classroom cannot be empty.");
    updates.classroom = classroom;
  }
  if (args.day !== undefined) {
    const day = typeof args.day === "string" ? args.day.trim().toLowerCase() : "";
    if (!DAYS_ORDER.includes(day)) return failure("The class day must be a valid Spanish weekday.");
    updates.day = day;
  }
  if (args.time_range !== undefined) {
    const timeRange = typeof args.time_range === "string" ? parseTimeRange(args.time_range.trim()) : undefined;
    if (!timeRange) return failure("The class time range must use HH:mm-HH:mm.");
    Object.assign(updates, timeRange);
  }

  return updates;
}

function classSuccess(action, classData, chatId, classStore) {
  const indexed = classStore.getAllSorted(chatId).find((item) => item.id === classData.id);
  const cls = indexed || classData;
  const confirmation = action === "add_class" ? MESSAGES.CLASS_ADDED(cls, capitalize(cls.day)) : MESSAGES.CLASS_EDITED(cls, capitalize(cls.day));
  return {
    success: true,
    action,
    class: formatClass(cls),
    message: MESSAGES.MUTATION_WITH_LIST(confirmation, formatAllClassesForChat(classStore, chatId)),
  };
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

function rescheduleClasses(classScheduler, chatId) {
  classScheduler?.rescheduleForChat(chatId);
}

function isOneBasedIndex(value) {
  return Number.isInteger(value) && value > 0;
}

function failure(error, userMessage) {
  return { success: false, error, userMessage };
}

module.exports = { createAiToolExecutor };
