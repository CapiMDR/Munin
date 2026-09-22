const NotesStore = require("./notesStore");

class CommandHandler {
  constructor(client, notesStore = new NotesStore()) {
    this.client = client;
    this.notesStore = notesStore;
  }

  async handleCommand(message, chatId) {
    const [command, ...args] = message.body.trim().split(/\s+/);

    switch (command.toLowerCase()) {
      case "!munin":
        await this.client.sendMessage(chatId, "¡Hola! Soy Munin, tu bot asistente de WhatsApp. Escribe !ayuda para ver los comandos disponibles.");
        break;

      case "!ping":
        await this.client.sendMessage(chatId, "pong");
        break;

      case "!echo":
        await this.client.sendMessage(chatId, args.join(" "));
        break;

      case "!agregar": {
        const note = args.join(" ").trim();

        if (!note) {
          await this.client.sendMessage(chatId, "Uso: !agregar <nota>");
          break;
        }

        this.notesStore.add(chatId, note);
        await this.client.sendMessage(chatId, "Nota agregada.");
        break;
      }

      case "!notas": {
        const notes = this.notesStore.getAll(chatId);
        const notesMessage =
          notes.length === 0 ? "No hay notas guardadas para este chat." : "Notas:\n" + notes.map((note, index) => `${index + 1}. ${note}`).join("\n");

        await this.client.sendMessage(chatId, notesMessage);
        break;
      }

      case "!borrar": {
        const noteNumber = Number(args[0]);

        if (args.length !== 1 || !Number.isInteger(noteNumber) || noteNumber < 1) {
          await this.client.sendMessage(chatId, "Uso: !borrar <índice>");
          break;
        }

        const wasDeleted = this.notesStore.remove(chatId, noteNumber - 1);
        await this.client.sendMessage(
          chatId,
          wasDeleted ? `Nota ${noteNumber} eliminada.` : "No existe una nota con ese índice en este chat.",
        );
        break;
      }

      case "!ayuda":
        await this.client.sendMessage(
          chatId,
          "Comandos:\n" +
            "!ping - Probar el bot\n" +
            "!echo <texto> - Repetir texto\n" +
            "!agregar <nota> - Guardar una nota\n" +
            "!notas - Mostrar las notas del chat\n" +
            "!borrar <índice> - Eliminar una nota\n" +
            "!ayuda - Mostrar comandos",
        );
        break;
    }
  }
}

module.exports = CommandHandler;
