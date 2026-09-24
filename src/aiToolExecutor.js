const { getPendingContent, parsePendingDate } = require("./pendingUtils");
const {
  formatMexicoCityDateTime,
  formatTimerDuration,
  getMexicoCityDateParts,
  mexicoCityDateTimeToTimestamp,
  parseClockTime,
  parseDuration,
  parseTimeRange,
  parseTimerDuration,
} = require("./timeUtils");
const { DAYS_ORDER } = require("./classStore");
const { MESSAGES } = require("./commandConstants");
const { formatAllClasses, formatClassesToday, formatPendings, formatReminders, formatSavedMessages } = require("./listResponseFormatter");
const { getMexicoCityTime } = require("./timeUtils");

const MINIMUM_RECURRING_REMINDER_MS = 10 * 60_000;

// This factory receives the application dependencies once at startup. Each tool
// execution then receives only request-specific context such as chatId/message.
function createAiToolExecutor({
  pendingStore,
  reminderStore,
  reminderScheduler,
  savedMessageStore,
  classStore,
  classScheduler,
  scheduleTimer,
  sendMessage,
}) {
  const handlers = {
    save_message: (args, context) => saveMessage(args, context, savedMessageStore),
    view_saved_message: (args, context) => viewSavedMessage(args, context, savedMessageStore, sendMessage),
    list_saved_messages: (args, context) => listSavedMessages(context, savedMessageStore),
    create_pending: (args, context) => createPending(args, context, pendingStore),
    list_pendings: (args, context) => listPendings(context, pendingStore),
    delete_pending: (args, context) => deletePending(args, context, pendingStore),
    create_reminder: (args, context) => createReminder(args, context, reminderStore, reminderScheduler),
    list_reminders: (args, context) => listReminders(context, reminderStore),
    delete_reminder: (args, context) => deleteReminder(args, context, reminderStore, reminderScheduler),
    start_timer: (args, context) => startTimer(args, context, scheduleTimer, sendMessage),
    show_help: (args) => showHelp(args),
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

function saveMessage(args, context, savedMessageStore) {
  const title = args.title?.trim();
  const quotedStanzaId = context.message._data?.quotedStanzaID;
  const quotedParticipant = context.message._data?.quotedParticipant;

  if (!title) return failure("A title is required.");
  if (!context.message.hasQuotedMsg || !quotedStanzaId || !quotedParticipant) {
    return failure("The user did not reply to a message. Tell them they must reply to the message they want to save.");
  }

  const quotedMessageId = `false_${context.chatId}_${quotedStanzaId}_${quotedParticipant}`;
  const updated = savedMessageStore.set(context.chatId, title, quotedMessageId);
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
  if (!content) return failure("Pending content is required.");
  if (args.date !== undefined && !date) return failure("The pending date must use a real dd/mm date.");

  pendingStore.add(context.chatId, content, date);
  return { success: true, action: "create_pending", content, date: date || null };
}

function listPendings(context, pendingStore) {
  const pendings = pendingStore.getAll(context.chatId);
  return { success: true, action: "list_pendings", message: formatPendings(pendings) };
}

function deletePending(args, context, pendingStore) {
  if (!isOneBasedIndex(args.index)) return failure("A positive pending index is required.");
  const pending = pendingStore.remove(context.chatId, args.index - 1);
  if (!pending) return failure(`There is no pending item at index ${args.index}.`);
  return { success: true, action: "delete_pending", index: args.index, content: getPendingContent(pending) };
}

function createReminder(args, context, reminderStore, reminderScheduler) {
  const content = args.content?.trim();
  const hasDuration = args.duration !== undefined;
  const hasAbsoluteTime = args.due_date !== undefined || args.due_time !== undefined;
  const hasRepeatCount = args.repeat_count !== undefined;
  const repeatForever = args.repeat_forever === true;

  if (!content) return failure("Reminder content is required.");
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
    ? reminderStore.addRecurring(context.chatId, content, dueAt, duration, repeatForever ? null : remaining)
    : reminderStore.add(context.chatId, content, dueAt);

  reminderScheduler.schedule({ chatId: context.chatId, ...reminder });
  return {
    success: true,
    action: "create_reminder",
    content,
    dueAt: formatMexicoCityDateTime(dueAt),
    timeZone: "America/Mexico_City",
    absolute: hasAbsoluteTime,
    recurring: hasRepeatCount || repeatForever,
    repetitions: repeatForever ? "infinite" : remaining || null,
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
  return { success: true, action: "delete_reminder", index: args.index, content: reminder.content };
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

function listClasses(context, classStore) {
  if (!classStore) return failure("The class store is unavailable.");

  return {
    success: true,
    action: "list_classes",
    message: formatAllClasses(classStore.getAllSorted(context.chatId)),
  };
}

function getAbsoluteReminderDueAt(args) {
  const dateName = args.due_date?.trim().toLowerCase();
  const normalizedDate = dateName === "hoy" ? "today" : dateName === "mañana" || dateName === "manana" ? "tomorrow" : dateName;
  const clockTime = parseClockTime(args.due_time);
  if (!clockTime || !["today", "tomorrow"].includes(normalizedDate)) {
    return failure("A valid absolute reminder date and time are required.", MESSAGES.REMINDER_INVALID_ABSOLUTE_TIME);
  }

  const date = getMexicoCityDateParts();
  if (normalizedDate === "tomorrow") {
    const tomorrow = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));
    date.year = tomorrow.getUTCFullYear();
    date.month = tomorrow.getUTCMonth() + 1;
    date.day = tomorrow.getUTCDate();
  }

  const dueAt = mexicoCityDateTimeToTimestamp({ ...date, ...clockTime });
  if (normalizedDate === "today" && dueAt <= Date.now()) {
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
    message: formatClassesToday(day, classStore.getByDay(context.chatId, day)),
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
  return { success: true, action: "delete_class", class: formatClass(existing) };
}

function setClassBell(args, context, classStore, classScheduler) {
  if (!classStore) return failure("The class store is unavailable.");
  if (typeof args.enabled !== "boolean") return failure("The bell state must be true or false.");

  const enabled = classStore.setBell(context.chatId, args.enabled);
  rescheduleClasses(classScheduler, context.chatId);
  return { success: true, action: "set_class_bell", enabled };
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
  return { success: true, action, class: formatClass(indexed || classData) };
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
