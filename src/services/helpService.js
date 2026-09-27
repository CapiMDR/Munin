const { failure, success } = require("./result");
const { MESSAGES } = require("../commandConstants");
function getHelp({ page }) {
  const resolvedPage = page === undefined ? 1 : page;
  const help = Number.isInteger(resolvedPage) ? MESSAGES.HELP_PAGE(resolvedPage) : undefined;
  return help ? success("HELP_FOUND", { page: resolvedPage, help }) : failure("HELP_PAGE_INVALID");
}
module.exports = { getHelp };
