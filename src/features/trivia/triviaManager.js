const {
  presentTriviaAlreadyActive,
  presentTriviaAnswerReveal,
  presentTriviaLeaderboard,
  presentTriviaScoreboard,
  presentTriviaSessionQuestion,
  presentTriviaStarting,
} = require("./triviaPresenter");

const QUESTION_DURATION_MS = 20_000;
const NEXT_QUESTION_DELAY_MS = 5_000;
const LEADERBOARD_EVERY_QUESTIONS = 3;
const TRIVIA_START_DELAY_MS = 10_000;

class TriviaManager {
  constructor({
    sendMessage,
    getPlayerName = (chatId, mentionId) => mentionId,
    recordTriviaGamePlayed = () => undefined,
    recordTriviaAnswer = () => undefined,
    recordTriviaGameWon = () => undefined,
    startDelayMs = TRIVIA_START_DELAY_MS,
    questionDurationMs = QUESTION_DURATION_MS,
    nextQuestionDelayMs = NEXT_QUESTION_DELAY_MS,
    leaderboardEveryQuestions = LEADERBOARD_EVERY_QUESTIONS,
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
  } = {}) {
    this.sendMessage = sendMessage;
    this.getPlayerName = getPlayerName;
    this.recordTriviaGamePlayed = recordTriviaGamePlayed;
    this.recordTriviaAnswer = recordTriviaAnswer;
    this.recordTriviaGameWon = recordTriviaGameWon;
    this.startDelayMs = startDelayMs;
    this.questionDurationMs = questionDurationMs;
    this.nextQuestionDelayMs = nextQuestionDelayMs;
    this.leaderboardEveryQuestions = leaderboardEveryQuestions;
    this.setTimeout = setTimeoutImpl;
    this.clearTimeout = clearTimeoutImpl;
    this.triviaSessions = new Map();
  }

  async start(chatId, trivia) {
    if (this.hasActiveSession(chatId)) return this.rejectNewSession(chatId);

    const questions = prepareQuestions(trivia?.results);
    if (!questions.length) throw new Error("Trivia has no questions.");

    this.triviaSessions.set(chatId, {
      questions,
      questionIndex: 0,
      answers: new Map(),
      scores: new Map(),
      state: "starting",
      questionStartedAt: Date.now(),
    });
    await this.sendMessage(chatId, presentTriviaStarting(this.startDelayMs / 1_000));
    const session = this.triviaSessions.get(chatId);
    session.startTimer = this.setTimeout(
      () => this.beginSession(chatId).catch((error) => console.error("Could not start trivia session:", error)),
      this.startDelayMs,
    );
    return true;
  }

  async beginSession(chatId) {
    const session = this.triviaSessions.get(chatId);
    if (!session || session.state !== "starting") return;
    session.state = "question";
    await this.sendCurrentQuestion(chatId);
  }

  isWaitingForAnswers(chatId) {
    return this.triviaSessions.get(chatId)?.state === "question";
  }

  hasActiveSession(chatId) {
    return this.triviaSessions.has(chatId);
  }

  async rejectNewSession(chatId) {
    await this.sendMessage(chatId, presentTriviaAlreadyActive());
    return false;
  }

  submitAnswer(chatId, mentionId, answer) {
    const session = this.triviaSessions.get(chatId);
    if (!session || session.state !== "question" || !/^[ABCD]$/.test(answer) || session.answers.has(mentionId)) return false;

    session.answers.set(mentionId, answer);
    if (!session.scores.has(mentionId)) {
      session.scores.set(mentionId, 0);
      this.recordTriviaGamePlayed(chatId, mentionId);
    }
    return true;
  }

  async sendCurrentQuestion(chatId) {
    const session = this.triviaSessions.get(chatId);
    if (!session || session.state !== "question") return;

    const question = session.questions[session.questionIndex];
    session.questionStartedAt = Date.now();
    await this.sendMessage(
      chatId,
      presentTriviaSessionQuestion(question, session.questionIndex + 1, session.questions.length, this.questionDurationMs / 1_000),
    );
    session.questionTimer = this.setTimeout(
      () => this.expireQuestion(chatId).catch((error) => console.error("Could not expire trivia question:", error)),
      this.questionDurationMs,
    );
  }

  async expireQuestion(chatId) {
    const session = this.triviaSessions.get(chatId);
    if (!session || session.state !== "question") return;

    session.state = "reveal";
    this.clearTimeout(session.questionTimer);
    const question = session.questions[session.questionIndex];
    const correctPlayers = [];
    for (const [mentionId, answer] of session.answers) {
      const correct = answer === question.correctOption;
      this.recordTriviaAnswer(chatId, mentionId, correct);
      if (!correct) continue;
      session.scores.set(mentionId, (session.scores.get(mentionId) || 0) + 1);
      correctPlayers.push(this.getPlayerName(chatId, mentionId));
    }

    await this.sendMessage(chatId, presentTriviaAnswerReveal(question, correctPlayers));
    const answeredQuestions = session.questionIndex + 1;
    const isFinalQuestion = answeredQuestions === session.questions.length;
    if (!isFinalQuestion && answeredQuestions % this.leaderboardEveryQuestions === 0) {
      await this.sendMessage(chatId, presentTriviaScoreboard(this.ranking(chatId, session)));
    }

    if (isFinalQuestion) {
      session.state = "finished";
      const ranking = this.ranking(chatId, session);
      const winningScore = ranking[0]?.score || 0;
      if (winningScore > 0)
        ranking.filter((player) => player.score === winningScore).forEach((player) => this.recordTriviaGameWon(chatId, player.mentionId));
      await this.sendMessage(chatId, presentTriviaLeaderboard(ranking));
      this.triviaSessions.delete(chatId);
      return;
    }

    session.nextQuestionTimer = this.setTimeout(
      () => this.nextQuestion(chatId).catch((error) => console.error("Could not send next trivia question:", error)),
      this.nextQuestionDelayMs,
    );
  }

  async nextQuestion(chatId) {
    const session = this.triviaSessions.get(chatId);
    if (!session || session.state !== "reveal") return;

    session.questionIndex += 1;
    session.answers.clear();
    session.state = "question";
    await this.sendCurrentQuestion(chatId);
  }

  ranking(chatId, session) {
    return [...session.scores.entries()]
      .map(([mentionId, score]) => ({ mentionId, name: this.getPlayerName(chatId, mentionId), score }))
      .sort((first, second) => second.score - first.score || first.name.localeCompare(second.name, "es-MX"));
  }
}

function prepareQuestions(results) {
  if (!Array.isArray(results)) return [];
  return results.map((question) => {
    const options = shuffle([
      { text: question.correct_answer, correct: true },
      ...question.incorrect_answers.map((text) => ({ text, correct: false })),
    ]).map((option, index) => ({ ...option, letter: String.fromCharCode(65 + index) }));
    return { ...question, options, correctOption: options.find((option) => option.correct)?.letter };
  });
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[otherIndex]] = [shuffled[otherIndex], shuffled[index]];
  }
  return shuffled;
}

module.exports = { TriviaManager, TRIVIA_START_DELAY_MS, QUESTION_DURATION_MS, NEXT_QUESTION_DELAY_MS, LEADERBOARD_EVERY_QUESTIONS };
