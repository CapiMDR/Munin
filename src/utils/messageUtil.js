const { getMexicoCityTime } = require("./timeUtils");

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
  getMessageBody,
  getQuotedMessage,
  getQuotedParticipantId,
  getSenderMentionId,
  getSerializedMessageId,
  isGroupChat,
  isImage,
  isNightMessage,
  isReplyToMessage,
  isSticker,
  isVoiceNote,
};
