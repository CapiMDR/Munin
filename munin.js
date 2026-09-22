const { Client, LocalAuth } = require("whatsapp-web.js");

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

async function handleCommand(message, chatId) {
  const [command, ...args] = message.body.trim().split(/\s+/);

  switch (command.toLowerCase()) {
    case "!ping":
      await client.sendMessage(chatId, "pong");
      break;

    case "!echo":
      await client.sendMessage(chatId, args.join(" "));
      break;

    case "!help":
      await client.sendMessage(chatId, "Commands:\n" + "!ping - Test the bot\n" + "!echo <text> - Repeat text\n" + "!help - Show commands");
      break;
  }
}

client.on("message_create", async (message) => {
  try {
    const chatId = message.id.remote;

    // Ignore anything that isn't a group
    if (!chatId?.endsWith("@g.us")) return;

    // Ignore non-command messages
    if (!message.body.startsWith("!")) return;

    await handleCommand(message, chatId);
  } catch (error) {
    console.error("Message handler error:", error);
  }
});

client.initialize();
