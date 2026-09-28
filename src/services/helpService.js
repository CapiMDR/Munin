const { failure, success } = require("./result");
const { getHelpPage } = require("../help/helpPages");
function getHelp({ page }) {
  const resolvedPage = page === undefined ? 1 : page;
  const help = Number.isInteger(resolvedPage) ? getHelpPage(resolvedPage) : undefined;
  return help ? success("HELP_FOUND", { page: resolvedPage, help }) : failure("HELP_PAGE_INVALID");
}
module.exports = { getHelp };
