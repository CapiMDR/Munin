const MAX_AMOUNT = 50;

class Summarizer {
  constructor(maxAmount = MAX_AMOUNT) {
    if (!Number.isInteger(maxAmount) || maxAmount < 1) {
      throw new Error("maxAmount must be a positive integer.");
    }

    this.maxAmount = maxAmount;
    this.messagesByChat = new Map();
  }

  // Stores an incoming message under its chat ID, keeping only the newest entries.
  addMessage(message) {
    const chatId = message?.id?.remote;
    if (!chatId) return false;

    const messages = this.messagesByChat.get(chatId) || [];
    messages.push(message);

    if (messages.length > this.maxAmount) {
      messages.splice(0, messages.length - this.maxAmount);
    }

    this.messagesByChat.set(chatId, messages);
    return true;
  }

  // Returns a copy so callers cannot alter the stored chat history directly.
  getMessages(chatId) {
    return [...(this.messagesByChat.get(chatId) || [])];
  }

  // Produces the compact conversation text that can safely be provided to an LLM.
  formatRecentMessages(chatId, amount, excludedMessage) {
    const messages = this.getMessages(chatId)
      .filter((message) => message !== excludedMessage)
      .slice(-amount);

    return messages.map((message) => `${getSenderName(message)}: ${getMessageContent(message)}`).join("\n");
  }
}

function getSenderName(message) {
  const name = message?._data?.notifyName || message?._data?.pushName || message?._data?.pushname;
  if (name) return name;

  const userId = message?.author || message?.id?.participant;
  return typeof userId === "string" ? userId.split("@")[0] : "Usuario";
}

function getMessageContent(message) {
  const content = typeof message?.body === "string" ? message.body.trim().replace(/\s+/g, " ") : "";
  return content || "[mensaje sin texto]";
}

module.exports = { MAX_AMOUNT, Summarizer };
