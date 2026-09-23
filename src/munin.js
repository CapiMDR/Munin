require("./envLoader");
const TEST_MODE = true;
const TEST_CHAT_ID = process.env.TEST_CHAT_ID?.trim() || "";

const { generateResponse, completeToolCall } = require("./muninAI");
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

  const prompt = removeMuninMention(message.body);
  if (!prompt) return;

  const aiResult = await generateResponse(chatId, sender.name, prompt);
  if (!aiResult) return;
  // Normal conversation
  if (aiResult.type === "message") {
    await client.sendMessage(chatId, aiResult.content);

    return;
  }

  // Munin wants to use one of our tools
  if (aiResult.type === "tool_call") {
    const toolResult = await executeToolCall(aiResult.toolCall, {
      chatId,
      message,
      sender,
    });

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

async function executeToolCall(toolCall, context) {
  let args;

  try {
    args = JSON.parse(toolCall.function.arguments || "{}");
  } catch {
    return {
      success: false,
      error: "The tool arguments were invalid.",
    };
  }

  console.log(`Tool call: ${toolCall.function.name}`, args);

  switch (toolCall.function.name) {
    case "save_message": {
      if (!context.message.hasQuotedMsg || !context.message._data?.quotedStanzaID || !context.message._data?.quotedParticipant) {
        return {
          success: false,
          error: "The user did not reply to a message. " + "Tell them they must reply to the message they want to save.",
        };
      }

      const quotedMessageId = `false_${context.chatId}_` + `${context.message._data.quotedStanzaID}_` + `${context.message._data.quotedParticipant}`;

      const alreadyExists = commandHandler.savedMessageStore.set(context.chatId, args.title, quotedMessageId);

      return {
        success: true,
        action: "save_message",
        title: args.title,
        updated: alreadyExists,
      };
    }

    case "view_saved_message": {
      const savedMessage = commandHandler.savedMessageStore.get(context.chatId, args.title);

      if (!savedMessage) {
        return {
          success: false,
          error: `There is no saved message titled "${args.title}".`,
        };
      }

      await client.sendMessage(context.chatId, `🐦‍⬛ ${savedMessage.title}`, {
        quotedMessageId: savedMessage.messageId,
      });

      return {
        success: true,
        action: "view_saved_message",
        title: savedMessage.title,
        messageWasShown: true,
      };
    }

    default:
      return {
        success: false,
        error: `Unknown tool: ${toolCall.function.name}`,
      };
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
