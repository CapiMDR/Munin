const TRIVIA_URL = "https://opentdb.com/api.php";
const REQUEST_TIMEOUT_MS = 10_000;
const MIN_QUESTIONS = 1;
const MAX_QUESTIONS = 50;

class OpenTriviaApi {
  constructor({ fetchImpl = fetch } = {}) {
    this.fetch = fetchImpl;
  }

  async getTrivia(amount) {
    if (!Number.isInteger(amount) || amount < MIN_QUESTIONS || amount > MAX_QUESTIONS) {
      throw new Error("Invalid trivia amount.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetch(`${TRIVIA_URL}?amount=${amount}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Open Trivia DB responded with ${response.status}.`);

      const data = await response.json();
      if (data?.response_code !== 0 || !Array.isArray(data?.results) || data.results.length !== amount) {
        throw new Error("Open Trivia DB returned no questions.");
      }

      return {
        response_code: 0,
        results: data.results.map(normalizeQuestion),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeQuestion(question) {
  if (!question?.question || !question?.correct_answer || !Array.isArray(question.incorrect_answers)) {
    throw new Error("Open Trivia DB returned an invalid question.");
  }
  return {
    category: decodeHtml(question.category),
    type: question.type,
    difficulty: question.difficulty,
    question: decodeHtml(question.question),
    correct_answer: decodeHtml(question.correct_answer),
    incorrect_answers: question.incorrect_answers.map(decodeHtml),
  };
}

function decodeHtml(value) {
  const namedEntities = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' };
  return String(value).replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|quot);/gi, (entity, code) => {
    if (code[0] !== "#") return namedEntities[code.toLowerCase()];
    const number = code[1].toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
    return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
  });
}

module.exports = OpenTriviaApi;
module.exports.MAX_QUESTIONS = MAX_QUESTIONS;
