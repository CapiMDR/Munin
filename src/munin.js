const { Client, LocalAuth, Poll } = require("whatsapp-web.js");
const CommandHandler = require("./commandHandler");
const PendingStore = require("./pendingStore");
const PendingScheduler = require("./pendingScheduler");
const ReminderScheduler = require("./reminderScheduler");
const ReminderStore = require("./reminderStore");
const ClassStore = require("./classStore");
const ClassScheduler = require("./classScheduler");
const AdminStore = require("./adminStore");

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

    await client.sendMessage(chatId, "🐦‍⬛ Munin ha llegado.\nUsa !ayuda para ver lo que puedo hacer.");
  } catch (error) {
    console.error("Group join error:", error);
  }
});

client.on("message_create", async (message) => {
  try {
    // Ignore messages sent by this bot to prevent command loops.
    if (message.fromMe || message.id?.fromMe) return;

    const chatId = message.id.remote;

    // Ignore anything that isn't a group
    if (!chatId?.endsWith("@g.us")) return;

    // Ignore non-command messages
    if (!message.body.startsWith("!")) return;

    // Get the quoted message if it exists
    const quotedMessage = await getQuotedMessage(message);

    // Get the sender information
    const sender = await getSender(message);

    // Print the received message and its quoted message (if any) for debugging purposes
    printReceivedMessage(message, sender);

    await commandHandler.handleCommand(message, chatId, quotedMessage, sender);
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
