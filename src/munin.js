require("./envLoader");

const TEST_MODE = false;
// When test mode excludes a group, the global admin can enable this to send a
// maintenance notice there instead of silently ignoring incoming messages.
const TEST_MODE_SEND_MAINTENANCE_MESSAGE = false;
const TEST_CHAT_ID = process.env.TEST_CHAT_ID?.trim() || "";

const { generateResponse, generateSummary, completeToolCall } = require("./muninAI");
const { createAiToolExecutor } = require("./aiToolExecutor");
const { Client, LocalAuth, Poll } = require("whatsapp-web.js");
const CommandHandler = require("./commandHandler");
const PendingStore = require("./pendingStore");
const PendingScheduler = require("./pendingScheduler");
const CustomCommandStore = require("./customCommandStore");
const SavedMessageStore = require("./savedMessageStore");
const ReminderScheduler = require("./reminderScheduler");
const ReminderStore = require("./reminderStore");
const ClassStore = require("./classStore");
const ClassScheduler = require("./classScheduler");
const AdminStore = require("./adminStore");
const { Summarizer } = require("./summarizer");
const { loadBotLid, saveBotLid } = require("./botIdentityStore");
const { MESSAGES } = require("./commandConstants");

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:");
  console.error(reason);
});

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:");
  console.error(error);
});

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: false,
  },
});

async function sendMessage(chatId, message, options) {
  return client.sendMessage(chatId, message, options);
}

async function sendPoll(chatId, title, options, allowMultipleAnswers) {
  return sendMessage(chatId, new Poll(title, options, { allowMultipleAnswers }));
}

const pendingStore = new PendingStore();
const customCommandStore = new CustomCommandStore();
const savedMessageStore = new SavedMessageStore();
const pendingScheduler = new PendingScheduler(pendingStore, sendMessage);
const reminderStore = new ReminderStore();
const reminderScheduler = new ReminderScheduler(reminderStore, sendMessage);
const classStore = new ClassStore();
const classScheduler = new ClassScheduler(classStore, sendMessage);
const adminStore = new AdminStore();
const summarizer = new Summarizer();
const aiToolExecutor = createAiToolExecutor({
  pendingStore,
  reminderStore,
  reminderScheduler,
  savedMessageStore,
  classStore,
  classScheduler,
  scheduleTimer,
  sendMessage,
  summarizer,
});
const commandHandler = new CommandHandler(
  sendMessage,
  pendingStore,
  reminderStore,
  reminderScheduler,
  sendPoll,
  classStore,
  classScheduler,
  scheduleTimer,
  adminStore,
  customCommandStore,
  savedMessageStore,
  () => botLid,
  summarizer,
  generateSummary,
);

reminderScheduler.start();
classScheduler.start();

function scheduleTimer(duration, callback) {
  return setTimeout(() => {
    callback().catch((error) => console.error("Could not deliver timer:", error));
  }, duration);
}

client.on("qr", (qr) => {
  console.log("QR received");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("AUTHENTICATED");
});

client.on("auth_failure", (msg) => {
  console.error("AUTH FAILURE:", msg);
});

let pendingSchedulerStarted = false;

client.on("ready", () => {
  console.log("READY");
  startPendingScheduler();
});

function startPendingScheduler() {
  if (pendingSchedulerStarted) return;

  pendingSchedulerStarted = true;
  pendingScheduler.start();
}

client.on("disconnected", (reason) => {
  console.log("DISCONNECTED:", reason);
});

client.on("group_join", async (notification) => {
  try {
    const chatId = notification.chatId;

    await client.sendMessage(chatId, "🐦‍⬛ Munin ha aterrizado.\nUsa !ayuda para ver lo que puede hacer.");
  } catch (error) {
    console.error("Group join error:", error);
  }
});

let botLid = loadBotLid();

if (botLid) {
  console.log("Loaded Munin LID:", botLid);
}

client.on("message_create", handleMessageCreate);

async function handleMessageCreate(message) {
  try {
    // Ignore bot messages to avoid infinite command intake (looking at you !echo !echo...)
    if (myOwnMessage(message)) return;

    summarizer.addMessage(message);

    const chatId = getChatId(message);
    // Munin is NOT a personal assistant
    if (!isGroupChat(chatId)) return;

    const body = getMessageBody(message);
    const isCommand = body.startsWith("!");
    const isMention = isBotMention(message);

    // Ignore random messages
    if (!isCommand && !isMention) return;

    // Only allow messages from test groupchats if on test mode
    if (isExcludedByTestMode(chatId)) {
      if (TEST_MODE_SEND_MAINTENANCE_MESSAGE) {
        await sendMessage(chatId, MESSAGES.TEST_MODE_MAINTENANCE);
      }
      return;
    }

    const sender = await getSender(message);
    //printReceivedMessage(message, sender);

    if (isCommand) return handleFormalCommand(message, chatId, sender);
    return handleMention(message, chatId, sender, isMention);
  } catch (error) {
    console.error("Message handler error:", error);
  }
}

// Ignore messages of the bot itself
function myOwnMessage(message) {
  if (!message.fromMe && !message.id?.fromMe) return false;
  //Learn the bot ID to recognize mentions. It is stored after the first execution run so this won't need to happen again
  learnBotLid(message);
  return true;
}

function learnBotLid(message) {
  if (botLid) return;

  botLid =
    message.id?.participant?._serialized ?? message.id?.participant ?? message._data?.id?.participant?._serialized ?? message._data?.id?.participant;

  if (botLid) {
    saveBotLid(botLid);
    console.log("Learned Munin LID:", botLid);
  }
}

function getChatId(message) {
  return message?.id?.remote;
}

function getMessageBody(message) {
  return typeof message?.body === "string" ? message.body : "";
}

function isExcludedByTestMode(chatId) {
  return TEST_MODE && chatId !== TEST_CHAT_ID;
}

function isGroupChat(chatId) {
  return Boolean(chatId?.endsWith("@g.us"));
}

// Exposing old !<command> interface just in case. The idea is to fully replace this with an LLM
async function handleFormalCommand(message, chatId, sender) {
  const quotedMessage = getQuotedMessage(message);
  const messageId = getSerializedMessageId(message);
  await commandHandler.handleCommand(message, chatId, quotedMessage, sender, messageId, getMessageBody(message).trim());
}

// Mentions trigger the LLM to respond
async function handleMention(message, chatId, sender, isMention = isBotMention(message)) {
  if (!isMention) return;

  // A bare mention is still an intentional request for Munin's attention.
  // Give the model explicit context instead of dropping that message silently.
  const prompt = (await getLLMPrompt(message)) || "El usuario te mencionó sin escribir ningún mensaje.";

  const aiResult = await generateResponse(chatId, sender.name, prompt);
  if (!aiResult) return;
  // Normal conversation
  if (aiResult.type === "message") {
    await client.sendMessage(chatId, aiResult.content);

    return;
  }

  // Munin wants to use one of our tools
  if (aiResult.type === "tool_call") {
    const toolResult = await aiToolExecutor.execute(aiResult.toolCall, {
      chatId,
      message,
    });

    // Help is already complete, canonical message text. Deliver it directly so
    // the follow-up model completion cannot omit or paraphrase the command list.
    if (toolResult.success && toolResult.action === "show_help") {
      await sendMessage(chatId, toolResult.help);
      return;
    }

    // List tools return canonical, application-owned text. Send it directly
    // instead of asking the LLM to reproduce or summarize stored data.
    if (toolResult.success && toolResult.message) {
      await sendMessage(chatId, toolResult.message);
      return;
    }

    // Tool validation can provide an exact, user-friendly response when a
    // follow-up model completion would otherwise be unable to answer.
    if (!toolResult.success && toolResult.userMessage) {
      await sendMessage(chatId, toolResult.userMessage);
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

    if (response) {
      await client.sendMessage(chatId, response);
    }

    return;
  }
}

function isBotMention(message) {
  return Boolean(botLid && message.mentionedIds?.includes(botLid));
}

function getQuotedMessage(message) {
  if (!message.hasQuotedMsg) {
    return undefined;
  }
  return message._data?.quotedMsg;
}

function removeMuninMention(body) {
  return body.replace(/^@\S+\s*/, "").trim();
}

// Builds the text the LLM receives. WhatsApp message bodies represent mentions
// as raw JIDs/numbers, so replace each one with its contact display name first.
async function getLLMPrompt(message) {
  let content = removeMuninMention(message.body || "");
  const mentionedIds = message.mentionedIds || [];
  let contacts = [];
  if (mentionedIds.length) {
    try {
      contacts = await message.getMentions();
    } catch (error) {
      console.warn("Could not resolve mentioned contacts for the LLM:", error.message);
    }
  }

  mentionedIds.forEach((mention, index) => {
    const mentionId = typeof mention === "string" ? mention : mention?._serialized;
    if (!mentionId) return;

    const contact = contacts[index];
    const displayName = contact?.pushname || contact?.name || contact?.shortName || contact?.number || "alguien";
    const rawMention = `@${mentionId.split("@")[0]}`;
    content = content.split(rawMention).join(`@${displayName}`);
  });

  const quotedContent = getQuotedMessage(message)?.body?.trim();
  if (!quotedContent) return content.trim();

  return `${content.trim()}\n\n[Mensaje citado]\n${sanitizeQuotedContent(quotedContent)}\n[/Mensaje citado]`;
}

function sanitizeQuotedContent(content) {
  // Quoted-message contact metadata is not resolved here, so remove raw
  // numeric mention tags before that content is sent to the LLM.
  return content.replace(/@\d{5,}(?=\s|$|[.,;:!?])/g, "@alguien");
}

function getSerializedMessageId(message) {
  const ids = [message.id, message._data?.id];
  for (const id of ids) {
    if (typeof id === "string") return id;
    if (id?._serialized) return id._serialized;
  }
  for (const id of ids) {
    if (typeof id?.fromMe === "boolean" && id.remote && id.id) return `${id.fromMe}_${id.remote}_${id.id}`;
  }
  return undefined;
}

async function getSender(message) {
  try {
    const contact = await message.getContact();
    const userName = contact.pushname || contact.name || contact.shortName;
    const mentionId = contact.id?._serialized || message.author || message.id.participant;

    if (!mentionId) {
      return userName ? { tag: userName } : undefined;
    }

    return {
      name: userName,
      tag: `@${mentionId.split("@")[0]}`,
      mentionId,
    };
  } catch (error) {
    console.warn("Could not retrieve sender contact:", error.message);
    return undefined;
  }
}

function printReceivedMessage(message, sender) {
  console.log("\n--- MESSAGE ---");
  console.log("chatId:", message.id.remote);
  console.log("userId:", sender?.mentionId || message.author || message.id.participant);
  console.log("userName:", sender?.name || "Unknown");
  console.log("body:", message.body);
  console.log("hasQuotedMsg:", message.hasQuotedMsg);
  if (message.hasQuotedMsg) {
    console.log("QUOTED DATA:");
    console.dir(message._data?.quotedMsg, { depth: 10 });
  }
}

client.initialize();
