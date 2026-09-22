const { Client, LocalAuth } = require("whatsapp-web.js");
const CommandHandler = require("./commandHandler");

process.on("unhandledRejection", (reason, promise) => {
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

async function sendMessage(chatId, message) {
  return client.sendMessage(chatId, message);
}

const commandHandler = new CommandHandler(sendMessage);

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

client.on("message_create", async (message) => {
  try {
    const chatId = message.id.remote;

    // Ignore anything that isn't a group
    if (!chatId?.endsWith("@g.us")) return;

    // Ignore non-command messages
    if (!message.body.startsWith("!")) return;

    // Get the quoted message if it exists
    const quotedMessage = await getQuotedMessage(message);

    // Print the received message and its quoted message (if any) for debugging purposes
    //printReceivedMessage(message);

    await commandHandler.handleCommand(message, chatId, quotedMessage);
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

function printReceivedMessage(message) {
  console.log("\n--- MESSAGE ---");
  console.log("body:", message.body);
  console.log("hasQuotedMsg:", message.hasQuotedMsg);
  if (message.hasQuotedMsg) {
    console.log("QUOTED DATA:");
    console.dir(message._data?.quotedMsg, { depth: 10 });
  }
}

client.initialize();
