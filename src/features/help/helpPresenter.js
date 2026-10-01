const { getHelpPageUsage } = require("./helpPages");
function presentHelpResult(result) {
  return result.ok
    ? { ok: true, action: "show_help", help: result.data.help, message: result.data.help }
    : { ok: false, code: result.code, message: getHelpPageUsage() };
}
module.exports = { presentHelpResult };
