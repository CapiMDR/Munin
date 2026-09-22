const NotesStore = require("./notesStore");
const {
  COIN_SIDES,
  COMMANDS,
  EIGHT_BALL_RESPONSES,
  MESSAGES,
} = require("./commandConstants");

class CommandHandler {
  constructor(sendMessage, notesStore = new NotesStore()) {
    this.sendMessage = sendMessage;
    this.notesStore = notesStore;
  }

  async handleCommand(message, chatId, quotedMessage) {
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
        await this.sendMessage(chatId, MESSAGES.NOTE_ADDED);
        break;
      }

      case COMMANDS.LIST_NOTES: {
        const notes = this.notesStore.getAll(chatId);
        const notesMessage =
          notes.length === 0 ? MESSAGES.NO_NOTES : `${MESSAGES.NOTES_HEADING}\n${notes.map((note, index) => `${index + 1}. ${note}`).join("\n")}`;

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
        await this.sendMessage(
          chatId,
          wasDeleted ? `${MESSAGES.NOTE_DELETED_PREFIX}${noteNumber}${MESSAGES.NOTE_DELETED_SUFFIX}` : MESSAGES.DELETE_NOTE_NOT_FOUND,
        );
        break;
      }

      case COMMANDS.COIN: {
        const coinFlip = COIN_SIDES[Math.floor(Math.random() * COIN_SIDES.length)];
        await this.sendMessage(chatId, MESSAGES.COIN_RESULT_PREFIX + coinFlip);
        break;
      }

      case COMMANDS.DICE: {
        const diceRoll = Math.floor(Math.random() * 6) + 1;
        await this.sendMessage(chatId, MESSAGES.DICE_RESULT_PREFIX + diceRoll);
        break;
      }

      case COMMANDS.EIGHT_BALL: {
        const randomResponse = EIGHT_BALL_RESPONSES[Math.floor(Math.random() * EIGHT_BALL_RESPONSES.length)];
        await this.sendMessage(chatId, MESSAGES.EIGHT_BALL_RESULT_PREFIX + randomResponse);
        break;
      }

      case COMMANDS.HELP:
        await this.sendMessage(chatId, MESSAGES.HELP_LINES.join("\n"));
        break;

      default:
        await this.sendMessage(chatId, MESSAGES.UNKNOWN_COMMAND);
        break;
    }
  }
}

module.exports = CommandHandler;
