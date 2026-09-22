const fs = require("fs");
const path = require("path");

class NotesStore {
  constructor(filePath = path.join(__dirname, "..", "notes.json")) {
    this.filePath = filePath;
    this.notesByChat = this.load();
  }

  // Load notes from the JSON file. If the file doesn't exist, it initializes an empty object.
  load() {
    try {
      const contents = fs.readFileSync(this.filePath, "utf8");
      const notesByChat = JSON.parse(contents);

      if (typeof notesByChat !== "object" || notesByChat === null || Array.isArray(notesByChat)) {
        throw new Error("The notes file must contain an object keyed by chat ID.");
      }

      return notesByChat;
    } catch (error) {
      if (error.code === "ENOENT") {
        return {};
      }

      throw error;
    }
  }

  // Add a note for a specific chat. If the chat doesn't exist, it initializes an empty array for that chat.
  add(chatId, note) {
    if (!this.notesByChat[chatId]) {
      this.notesByChat[chatId] = [];
    }

    this.notesByChat[chatId].push(note);
    this.save();
  }

  getAll(chatId) {
    return this.notesByChat[chatId] || [];
  }

  // Remove a note by its index (0-based) for a specific chat. Returns true if the note was removed, false if the index was invalid.
  remove(chatId, index) {
    const notes = this.notesByChat[chatId];

    if (!notes || index < 0 || index >= notes.length) {
      return false;
    }

    notes.splice(index, 1);
    this.save();
    return true;
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.notesByChat, null, 2));
  }
}

module.exports = NotesStore;
