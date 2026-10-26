const { MESSAGES } = require("../core/messages");
const { getImageDataUrl } = require("../features/vision/visionInput");
const { FEATHER_COOLDOWN_MS, SEND_MAINTENANCE_MESSAGE, TEST_CHAT_ID, TEST_MODE } = require("../config/settings");
const {
  countWords,
  formatMessageForLLM,
  getChatId,
  getImageMessage,
  getMentionIds,
  getMessageBody,
  getMessageTimestampIso,
  getQuotedMessage,
  getQuotedParticipantId,
  getSenderMentionId,
  getSerializedMessageId,
  isGroupChat,
  isImage,
  isNightMessage,
  isOwnMessage,
  isReplyToMessage,
  isSticker,
  isVoiceNote,
  getMentionedUsers,
  getSender,
  isBotMention,
} = require("../utils/messageUtils");

function createMessageHandler({
  initialBotLid,
  saveBotLid,
  getCommandHandler,
  adminStore,
  userStatsStore,
  summarizer,
  triviaManager,
  shouldAwardFeather,
  generateResponse,
  aiToolExecutor,
  completeToolCall,
  output,
  scheduleTimer,
  debugQuotedMessageDate = false,
}) {
  let botLid = initialBotLid;
  const deliverText = (chatId, text, options) => deliverOutputs([{ type: "text", chatId, text, options }]);

  if (botLid) console.log("Loaded Munin LID:", botLid);

  async function handleMessageCreate(message) {
    try {
      if (isOwnMessage(message)) {
        learnBotLid(message);
        return;
      }

      const chatId = getChatId(message);
      if (!isGroupChat(chatId)) return;

      const sender = await getSender(message);
      const mentionedUsers = await getMentionedUsers(message);
      const senderMentionId = getSenderMentionId(message, sender);
      if (isSenderBanned(chatId, message, sender)) return;

      summarizer.addMessage(message);

      const body = getMessageBody(message);
      const quotedMessage = getQuotedMessage(message);
      if (debugQuotedMessageDate && quotedMessage) console.log("Quoted message date:", getMessageTimestampIso(quotedMessage));
      const isCommand = body.startsWith("!");
      const isMention = isBotMention(message, botLid);

      userStatsStore.recordMessage(chatId, {
        mentionId: senderMentionId,
        name: sender?.name || sender?.tag,
        replyToMentionId: getQuotedParticipantId(message),
        isReply: isReplyToMessage(message),
        mentionedIds: getMentionIds(message),
        mentionedUsers,
        botMentionId: botLid,
        isSticker: isSticker(message),
        isImage: isImage(message),
        isVoiceNote: isVoiceNote(message),
        isNightMessage: isNightMessage(message),
        words: countWords(body),
        isCommand,
      });

      const answer = body.trim().toUpperCase();
      if (triviaManager.isWaitingForAnswers(chatId) && /^[ABCD]$/.test(answer)) {
        triviaManager.submitAnswer(chatId, sender.mentionId, answer);
        await reactToMessage(message, "🐦‍⬛");
        return;
      }

      if (!isCommand && !isMention) return;

      if (TEST_MODE && chatId !== TEST_CHAT_ID) {
        if (SEND_MAINTENANCE_MESSAGE) await deliverText(chatId, MESSAGES.TEST_MODE_MAINTENANCE);
        return;
      }
      //console.dir(message._data, { depth: 3 });
      if (isCommand) return handleFormalCommand(message, chatId, sender);
      return handleMention(message, chatId, sender, isMention);
    } catch (error) {
      console.error("Message handler error:", error);
    }
  }

  function getBotLid() {
    return botLid;
  }

  function learnBotLid(message) {
    if (botLid) return;
    botLid =
      message.id?.participant?._serialized ??
      message.id?.participant ??
      message._data?.id?.participant?._serialized ??
      message._data?.id?.participant;

    if (botLid) {
      saveBotLid(botLid);
      console.log("Learned Munin LID:", botLid);
    }
  }

  function isSenderBanned(chatId, message, sender) {
    const senderIds = [sender?.mentionId, message?.author, message?.id?.participant, message?._data?.id?.participant]
      .map((id) => (typeof id === "string" ? id : id?._serialized))
      .filter(Boolean);
    return senderIds.some((senderId) => adminStore.isBanned(chatId, senderId));
  }

  async function handleFormalCommand(message, chatId, sender) {
    const outputs = await getCommandHandler().handleCommand(
      message,
      chatId,
      getQuotedMessage(message),
      sender,
      getSerializedMessageId(message),
      getMessageBody(message).trim(),
    );
    await deliverOutputs(outputs);
  }

  async function deliverOutputs(outputs) {
    for (const outputDto of outputs || []) {
      if (outputDto.type === "schedule") {
        scheduleTimer?.(outputDto.duration, () => deliverOutputs([outputDto.output]));
        continue;
      }

      try {
        await output.deliver(outputDto);
      } catch (error) {
        if (!outputDto.fallbackText) throw error;
        console.error("Could not deliver output:", error.message);
        await output.deliver({ type: "text", chatId: outputDto.chatId, text: outputDto.fallbackText });
      }
    }
  }

  async function handleMention(message, chatId, sender, isMention = isBotMention(message, botLid)) {
    if (!isMention) return;

    const prompt = (await formatMessageForLLM(message, botLid)) || "El usuario te mencionó sin escribir ningún mensaje.";
    const imageDataUrl = await getMentionImageDataUrl(message);
    console.log("Mention vision routing:", {
      isImage: isImage(message),
      hasVisionInput: Boolean(imageDataUrl),
    });
    const featherDecision = shouldAwardFeather(prompt).catch((error) => {
      console.warn("Could not judge feather award:", error.message);
      return false;
    });
    const aiResult = await generateResponse(chatId, sender.name, { text: prompt, imageDataUrl });
    if (!aiResult) return;
    if (await featherDecision) await awardFeather(message, chatId, sender);

    if (aiResult.type === "message") {
      await deliverText(chatId, aiResult.content);
      return;
    }

    if (aiResult.type !== "tool_call") return;
    const toolResult = await aiToolExecutor.execute(aiResult.toolCall, {
      chatId,
      message,
      messageId: getSerializedMessageId(message),
      botLid,
      sender,
    });

    if (toolResult.success && toolResult.action === "show_help") {
      await deliverText(chatId, toolResult.help);
      return;
    }
    if (toolResult.success && ["send_animal_image", "generate_image", "start_trivia", "create_poll"].includes(toolResult.action)) return;
    if (toolResult.success && toolResult.message) {
      await deliverText(chatId, toolResult.message);
      return;
    }
    if (!toolResult.success && toolResult.userMessage) {
      await deliverText(chatId, toolResult.userMessage);
      return;
    }

    const response = await completeToolCall(
      chatId,
      aiResult.toolCall,
      toolResult,
      aiResult.messages,
      aiResult.assistantMessage,
      aiResult.userMessage,
    );
    if (response) await deliverText(chatId, response);
  }

  async function awardFeather(message, chatId, sender) {
    const mentionId = getSenderMentionId(message, sender);
    if (!adminStore.isGlobalAdmin(mentionId) && !userStatsStore.canReceiveFeather(chatId, mentionId)) return;

    try {
      await reactToMessage(message, "🪶");
      userStatsStore.recordFeather(chatId, mentionId, FEATHER_COOLDOWN_MS);
    } catch (error) {
      console.warn("Could not award feather:", error.message);
    }
  }

  async function getMentionImageDataUrl(message) {
    try {
      const imageMessage = await getImageMessage(message);
      if (!imageMessage) return undefined;

      console.log("Vision image source:", imageMessage === message ? "mention" : "quoted message");
      return await getImageDataUrl(imageMessage);
    } catch (error) {
      console.warn("Could not prepare image for the LLM:", error.message);
      return undefined;
    }
  }

  async function reactToMessage(message, reaction) {
    const messageId = getSerializedMessageId(message);
    if (!messageId) throw new Error("Could not determine serialized message ID.");
    return output.deliver({ type: "reaction", messageId, emoji: reaction });
  }

  return { getBotLid, handleMessageCreate, reactToInvokingMessage: reactToMessage };
}

module.exports = { createMessageHandler };
