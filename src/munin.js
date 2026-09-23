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

client.on("message_create", async (message) => {
  try {
    // Ignore Munin's own messages, but learn its LID first if necessary.
    if (message.fromMe || message.id?.fromMe) {
      if (!botLid) {
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

      return;
    }

    const chatId = message.id.remote;

    if (!chatId?.endsWith("@g.us")) return;

    const commandText = getCommandText(message, botLid);
    if (!commandText) return;

    const quotedMessage = await getQuotedMessage(message);
    const sender = await getSender(message);
    const messageId = getSerializedMessageId(message);

    //printReceivedMessage(message, sender);

    await commandHandler.handleCommand(message, chatId, quotedMessage, sender, messageId, commandText);
  } catch (error) {
    console.error("Message handler error:", error);
  }
});

function getQuotedMessage(message) {
  if (!message.hasQuotedMsg) {
    return undefined;
  }
  return message._data?.quotedMsg;
}

function getCommandText(message, botLid) {
  const body = message.body?.trim();
  if (!body) return undefined;

  // Regular command: !ping
  if (body.startsWith("!")) return body;

  // Mention command: @Munin ping
  if (!botLid || !message.mentionedIds?.includes(botLid)) {
    return undefined;
  }

  const commandWithoutMention = body.replace(/^@\S+\s*/, "").trim();

  if (!commandWithoutMention) return undefined;

  return commandWithoutMention.startsWith("!") ? commandWithoutMention : `!${commandWithoutMention}`;
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
