require("./envLoader");

const TEST_MODE = true;
const TEST_CHAT_ID = process.env.TEST_CHAT_ID?.trim() || "";

const { generateResponse, completeToolCall } = require("./muninAI");
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
const { loadBotLid, saveBotLid } = require("./botIdentityStore");

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
const aiToolExecutor = createAiToolExecutor({
  pendingStore,
  reminderStore,
  reminderScheduler,
  savedMessageStore,
  classStore,
  classScheduler,
  scheduleTimer,
  sendMessage,
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
);

reminderScheduler.start();
classScheduler.start();
pendingScheduler.start();

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

client.on("ready", () => {
  console.log("READY");
});

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
    if (handleOwnMessage(message)) return;

    const chatId = message.id.remote;
    if (!isEligibleChat(chatId)) return;

    const sender = await getSender(message);
    if (message.body.startsWith("!")) {
      await handleFormalCommand(message, chatId, sender);
      return;
    }

    await handleMention(message, chatId, sender);
  } catch (error) {
    console.error("Message handler error:", error);
  }
}

// Ignore messages of the bot itself
function handleOwnMessage(message) {
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

// Only accept group chats and only allow test chat when testing
function isEligibleChat(chatId) {
  if (TEST_MODE && chatId !== TEST_CHAT_ID) return false;
  return chatId?.endsWith("@g.us");
}

// Exposing old !<command> interface just in case. The idea is to fully replace this with an LLM
async function handleFormalCommand(message, chatId, sender) {
  const quotedMessage = getQuotedMessage(message);
  const messageId = getSerializedMessageId(message);

  printReceivedMessage(message, sender);
  await commandHandler.handleCommand(message, chatId, quotedMessage, sender, messageId, message.body.trim());
}

// Mentions trigger the LLM to respond
async function handleMention(message, chatId, sender) {
  if (!botLid || !message.mentionedIds?.includes(botLid)) return;

  // A bare mention is still an intentional request for Munin's attention.
  // Give the model explicit context instead of dropping that message silently.
  const prompt = removeMuninMention(message.body) || "El usuario te mencionó sin escribir ningún mensaje.";

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

function getQuotedMessage(message) {
  if (!message.hasQuotedMsg) {
    return undefined;
  }
  return message._data?.quotedMsg;
}

function removeMuninMention(body) {
  return body.replace(/^@\S+\s*/, "").trim();
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
