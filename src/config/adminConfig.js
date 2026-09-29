require("./envLoader");

// Set GLOBAL_ADMIN_ID to your WhatsApp ID (for example, "1234567898765@c.us").
// This admin has access in every group.
const GLOBAL_ADMIN_ID = process.env.GLOBAL_ADMIN_ID?.trim() || "";

module.exports = { GLOBAL_ADMIN_ID };
