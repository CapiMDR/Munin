const { MESSAGES } = require("../commandConstants");
function presentHelpResult(result) { return result.ok ? { ok: true, action: "show_help", help: result.data.help, message: result.data.help } : { ok: false, code: result.code, message: MESSAGES.HELP_PAGE_USAGE }; }
module.exports = { presentHelpResult };
