function createConversationStore(maxHistory = 20) {
  const histories = new Map();
  function get(chatId) {
    return histories.get(chatId) || (histories.set(chatId, []), histories.get(chatId));
  }
  function trim(history) {
    if (history.length > maxHistory) history.splice(0, history.length - maxHistory);
  }
  function append(chatId, ...messages) {
    const history = get(chatId);
    history.push(...messages);
    trim(history);
  }
  return { append, get, trim };
}
module.exports = { createConversationStore };
