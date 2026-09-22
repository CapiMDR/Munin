const NotesStore = require("./notesStore");
const ReminderStore = require("./reminderStore");
const { COIN_SIDES, COMMANDS, EIGHT_BALL_RESPONSES, MESSAGES } = require("./commandConstants");

class CommandHandler {
  constructor(sendMessage, notesStore = new NotesStore(), reminderStore = new ReminderStore(), reminderScheduler, sendPoll) {
    this.sendMessage = sendMessage;
    this.notesStore = notesStore;
    this.reminderStore = reminderStore;
    this.reminderScheduler = reminderScheduler;
    this.sendPoll = sendPoll;
  }

  async handleCommand(message, chatId, quotedMessage, sender) {
    const [command, ...args] = message.body.trim().split(/\s+/);

    switch (command.toLowerCase()) {
      case COMMANDS.MUNIN:
        await this.sendMessage(chatId, MESSAGES.WELCOME);
        break;

      case COMMANDS.PING:
        await this.sendMessage(chatId, MESSAGES.PONG);
        break;

      case COMMANDS.ECHO:
        await this.sendMessage(chatId, args.join(" "));
        break;

      case COMMANDS.ADD_NOTE: {
        let note = args.join(" ").trim();

        if (!note) {
          note = quotedMessage?.body?.trim() || "";
        }

        if (!note) {
          await this.sendMessage(chatId, MESSAGES.ADD_NOTE_USAGE);
          break;
        }

        this.notesStore.add(chatId, note);
        await this.sendMessage(chatId, MESSAGES.NOTE_ADDED(note));
        break;
      }

      case COMMANDS.LIST_NOTES: {
        const notes = this.notesStore.getAll(chatId);
        const notesMessage = notes.length === 0 ? MESSAGES.NO_NOTES : MESSAGES.NOTES_LIST(notes);

        await this.sendMessage(chatId, notesMessage);
        break;
      }

      case COMMANDS.DELETE_NOTE: {
        const noteNumber = Number(args[0]);

        if (args.length !== 1 || !Number.isInteger(noteNumber) || noteNumber < 1) {
          await this.sendMessage(chatId, MESSAGES.DELETE_NOTE_USAGE);
          break;
        }

        const wasDeleted = this.notesStore.remove(chatId, noteNumber - 1);
        await this.sendMessage(chatId, wasDeleted ? MESSAGES.NOTE_DELETED(noteNumber) : MESSAGES.DELETE_NOTE_NOT_FOUND);
        break;
      }

      case COMMANDS.ADD_REMINDER: {
        const durationText = args[0];
        const duration = parseDuration(durationText);
        let content = args.slice(1).join(" ").trim();

        if (!content) {
          content = quotedMessage?.body?.trim() || "";
        }

        if (!content || !duration) {
          await this.sendMessage(chatId, MESSAGES.ADD_REMINDER_USAGE);
          break;
        }

        const reminder = this.reminderStore.add(chatId, content, Date.now() + duration);
        this.reminderScheduler?.schedule({
          chatId,
          ...reminder,
        });
        await this.sendMessage(
          chatId,
          MESSAGES.REMINDER_ADDED(sender?.tag, formatDuration(durationText), content),
          sender?.mentionId ? { mentions: [sender.mentionId] } : undefined,
        );
        break;
      }

      case COMMANDS.LIST_REMINDERS: {
        const reminders = this.reminderStore.getAll(chatId);
        const remindersMessage = reminders.length === 0 ? MESSAGES.NO_REMINDERS : MESSAGES.REMINDERS_LIST(reminders.map(formatReminder));

        await this.sendMessage(chatId, remindersMessage);
        break;
      }

      case COMMANDS.DELETE_REMINDER: {
        const reminderNumber = Number(args[0]);

        if (args.length !== 1 || !Number.isInteger(reminderNumber) || reminderNumber < 1) {
          await this.sendMessage(chatId, MESSAGES.DELETE_REMINDER_USAGE);
          break;
        }

        const reminder = this.reminderStore.remove(chatId, reminderNumber - 1);

        if (reminder) {
          this.reminderScheduler?.cancel(reminder.id);
        }

        await this.sendMessage(chatId, reminder ? MESSAGES.REMINDER_DELETED(reminderNumber) : MESSAGES.DELETE_REMINDER_NOT_FOUND);
        break;
      }

      case COMMANDS.COIN: {
        const coinFlip = COIN_SIDES[Math.floor(Math.random() * COIN_SIDES.length)];
        await this.sendMessage(chatId, MESSAGES.COIN_RESULT(coinFlip));
        break;
      }

      case COMMANDS.DICE: {
        const diceRoll = Math.floor(Math.random() * 6) + 1;
        await this.sendMessage(chatId, MESSAGES.DICE_RESULT(diceRoll));
        break;
      }

      case COMMANDS.EIGHT_BALL: {
        const randomResponse = EIGHT_BALL_RESPONSES[Math.floor(Math.random() * EIGHT_BALL_RESPONSES.length)];
        await this.sendMessage(chatId, MESSAGES.EIGHT_BALL_RESULT(randomResponse));
        break;
      }

      case COMMANDS.RANDOM: {
        const options = args
          .join(" ")
          .split(",")
          .map((option) => option.trim())
          .filter(Boolean);

        if (options.length < 2) {
          await this.sendMessage(chatId, MESSAGES.RANDOM_USAGE);
          break;
        }

        const randomChoice = options[Math.floor(Math.random() * options.length)];
        await this.sendMessage(chatId, MESSAGES.RANDOM_RESULT(randomChoice));
        break;
      }

      case COMMANDS.POLL:
      case COMMANDS.MULTIPLE_POLL: {
        const pollValues = args
          .join(" ")
          .split(",")
          .map((option) => option.trim())
          .filter(Boolean);
        const [title, ...options] = pollValues;

        if (options.length < 2) {
          await this.sendMessage(chatId, MESSAGES.POLL_USAGE);
          break;
        }

        await this.sendPoll(chatId, title, options, command.toLowerCase() === COMMANDS.MULTIPLE_POLL);
        break;
      }

      case COMMANDS.HELP: {
        await this.sendMessage(chatId, MESSAGES.HELP);
        break;
      }

      default: {
        await this.sendMessage(chatId, MESSAGES.UNKNOWN_COMMAND);
        break;
      }
    }
  }
}

function parseDuration(value) {
  const match = value?.match(/^(\d+)([mhd])$/i);

  if (!match) {
    return undefined;
  }

  const amount = Number(match[1]);
  const unitInMilliseconds = {
    m: 60_000,
    h: 60 * 60_000,
    d: 24 * 60 * 60_000,
  };

  return amount > 0 ? amount * unitInMilliseconds[match[2].toLowerCase()] : undefined;
}

function formatReminder(reminder) {
  return `${reminder.content} (vence ${new Date(reminder.dueAt).toLocaleString("es-MX")})`;
}

function formatDuration(value) {
  const [, amount, unit] = value.match(/^(\d+)([mhd])$/i);
  const unitNames = {
    m: amount === "1" ? "minuto" : "minutos",
    h: amount === "1" ? "hora" : "horas",
    d: amount === "1" ? "día" : "días",
  };

  return `${amount} ${unitNames[unit.toLowerCase()]}`;
}

module.exports = CommandHandler;
