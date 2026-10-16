const { tavily } = require("@tavily/core");
const { failure, success } = require("../../core/result");

const client = tavily({
  apiKey: process.env.TAVILY_API_KEY,
});

async function searchWeb(query) {
  const normalizedQuery = typeof query === "string" ? query.trim() : "";
  if (!normalizedQuery) return failure("WEB_SEARCH_QUERY_INVALID");

  try {
    const result = await client.search(normalizedQuery, {
      maxResults: 5,
      searchDepth: "basic",
      topic: "general",
    });

    const results = (result.results || []).map(({ title, url, content }) => ({ title, url, content }));
    return success("WEB_SEARCH_FOUND", { query: normalizedQuery, results });
  } catch (error) {
    console.error("Could not search the web:", error.message);
    return failure("WEB_SEARCH_UNAVAILABLE");
  }
}

module.exports = { searchWeb };
