const NotesStore = require("./notesStore");

class CommandHandler {
  constructor(sendMessage, notesStore = new NotesStore()) {
    this.sendMessage = sendMessage;
    this.notesStore = notesStore;
  }

  async handleCommand(message, chatId, quotedMessage) {
    const [command, ...args] = message.body.trim().split(/\s+/);

    switch (command.toLowerCase()) {
      case "!munin":
        await this.sendMessage(chatId, "¡Hola! Soy Munin, tu bot asistente de WhatsApp. Escribe !ayuda para ver los comandos disponibles.");
        break;

      case "!ping":
        await this.sendMessage(chatId, "pong");
        break;

      case "!echo":
        await this.sendMessage(chatId, args.join(" "));
        break;

      // If no arguments are provided, it will try to use the quoted message as the note. If neither is available, it will send a usage message.
      case "!agregar": {
        let note = args.join(" ").trim();

        if (!note) {
          note = quotedMessage?.body?.trim() || "";
        }

        if (!note) {
          await this.sendMessage(chatId, "Uso: !agregar <nota> o responde a un mensaje con !agregar");
          break;
        }

        this.notesStore.add(chatId, note);
        await this.sendMessage(chatId, "Nota agregada.");
        break;
      }

      case "!notas": {
        const notes = this.notesStore.getAll(chatId);
        const notesMessage =
          notes.length === 0 ? "No hay notas guardadas para este chat." : "Notas:\n" + notes.map((note, index) => `${index + 1}. ${note}`).join("\n");

        await this.sendMessage(chatId, notesMessage);
        break;
      }

      case "!borrar": {
        const noteNumber = Number(args[0]);

        if (args.length !== 1 || !Number.isInteger(noteNumber) || noteNumber < 1) {
          await this.sendMessage(chatId, "Uso: !borrar <índice>");
          break;
        }

        const wasDeleted = this.notesStore.remove(chatId, noteNumber - 1);
        await this.sendMessage(chatId, wasDeleted ? `Nota ${noteNumber} eliminada.` : "No existe una nota con ese índice en este chat.");
        break;
      }

      case "!dado":
        const diceRoll = Math.floor(Math.random() * 6) + 1;
        await this.sendMessage(chatId, `🎲 Has sacado un ${diceRoll}`);
        break;

      case "!moneda":
        const coinFlip = Math.random() < 0.5 ? "cara" : "cruz";
        await this.sendMessage(chatId, `🪙 Ha salido ${coinFlip}`);
        break;

      case "!ayuda":
        await this.sendMessage(
          chatId,
          "Comandos:\n" +
            "!ping - Probar el bot\n" +
            "!echo <texto> - Repetir texto\n" +
            "!agregar <nota> - Guardar una nota\n" +
            "!borrar <índice> - Eliminar una nota\n" +
            "!notas - Mostrar las notas del chat\n" +
            "!dado - Lanzar un dado\n" +
            "!moneda - Lanzar una moneda\n" +
            "!ayuda - Mostrar comandos",
        );
        break;

      default:
        await this.sendMessage(chatId, "Comando no reconocido. Escribe !ayuda para ver los comandos disponibles.");
        break;
    }
  }
}

module.exports = CommandHandler;
