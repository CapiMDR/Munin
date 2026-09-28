const { getMexicoCityTime } = require("./timeUtils");

/**
 * Resolves the WhatsApp contact that sent a message into Munin's sender DTO.
 * @param {object} message WhatsApp message.
 * @returns {Promise<{name?: string, tag: string, mentionId?: string}|undefined>} Sender details.
 */
async function getSender(message) {
  try {
    const contact = await message.getContact();
    const userName = contact.pushname || contact.name || contact.shortName;
    const mentionId = contact.id?._serialized || message.author || message.id.participant;
    if (!mentionId) return userName ? { tag: userName } : undefined;
    return { name: userName, tag: `@${mentionId.split("@")[0]}`, mentionId };
  } catch (error) {
    console.warn("Could not retrieve sender contact:", error.message);
    return undefined;
  }
}

/**
 * Resolves users mentioned in a WhatsApp message.
 * @param {object} message WhatsApp message.
 * @returns {Promise<Array<{mentionId: string, name: string}>>} Mentioned users.
 */
async function getMentionedUsers(message) {
  if (!message.mentionedIds?.length) return [];
  try {
    const contacts = await message.getMentions();
    return contacts
      .map((contact) => ({
        mentionId: contact.id?._serialized,
        name: contact.pushname || contact.name || contact.shortName,
      }))
      .filter((user) => user.mentionId && user.name);
  } catch (error) {
    console.warn("Could not retrieve mentioned contacts:", error.message);
    return [];
  }
}

/**
 * Determines whether a message mentions Munin's WhatsApp LID.
 * @param {object} message WhatsApp message.
 * @param {string|undefined} botLid Munin's WhatsApp LID.
 * @returns {boolean} Whether Munin was mentioned.
 */
function isBotMention(message, botLid) {
  return Boolean(botLid && message.mentionedIds?.includes(botLid));
}

function getChatId(message) {
  return message?.id?.remote;
}

function getMessageBody(message) {
  return typeof message?.body === "string" ? message.body : "";
}

function getSenderMentionId(message, sender) {
  return sender?.mentionId || message?.author || message?.id?.participant || message?._data?.id?.participant;
}

function isReplyToMessage(message) {
  return Boolean(message?.hasQuotedMsg);
}

function getQuotedParticipantId(message) {
  const participant = message?._data?.quotedParticipant;
  return isReplyToMessage(message) ? (typeof participant === "string" ? participant : participant?._serialized) : undefined;
}

function getMentionIds(message) {
  return (message?.mentionedIds || []).map((item) => (typeof item === "string" ? item : item?._serialized)).filter(Boolean);
}

function isSticker(message) {
  return message?.type === "sticker" || message?._data?.type === "sticker";
}

function isImage(message) {
  return message?.type === "image" || message?._data?.type === "image";
}

function isVoiceNote(message) {
  return message?.type === "ptt" || message?._data?.type === "ptt";
}

function isNightMessage(message) {
  const timestamp = Number(message?.timestamp);
  return getMexicoCityTime(Number.isFinite(timestamp) ? new Date(timestamp * 1_000) : new Date()).minutes < 360;
}

function countWords(text) {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

function isGroupChat(chatId) {
  return Boolean(chatId?.endsWith("@g.us"));
}

/**
 * Determines whether a WhatsApp message was sent by Munin's own account.
 * @param {object} message WhatsApp message.
 * @returns {boolean} Whether the message is outgoing.
 */
function isOwnMessage(message) {
  return Boolean(message?.fromMe || message?.id?.fromMe);
}

function getQuotedMessage(message) {
  return message?.hasQuotedMsg ? message._data?.quotedMsg : undefined;
}

function getSerializedMessageId(message) {
  for (const id of [message.id, message._data?.id]) {
    if (typeof id === "string") return id;
    if (id?._serialized) return id._serialized;
    if (id?.$1) return id.$1;
  }
  return undefined;
}

module.exports = {
  countWords,
  getChatId,
  getMentionIds,
  getMentionedUsers,
  getMessageBody,
  getQuotedMessage,
  getQuotedParticipantId,
  getSender,
  getSenderMentionId,
  getSerializedMessageId,
  isBotMention,
  isGroupChat,
  isImage,
  isNightMessage,
  isOwnMessage,
  isReplyToMessage,
  isSticker,
  isVoiceNote,
};

