const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CONTENT_LENGTH = 2000;
const INTENT_CONTEXT_MAX_CHARS = 1200;
const INTENT_SNIPPET_MAX_CHARS = 400;

type HistoryTurn = { role: string; content: string };

/**
 * Normalize client chat history for the copilot prompt.
 */
const normalizeChatHistory = (history: unknown): HistoryTurn[] => {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(
      (turn): turn is HistoryTurn =>
        Boolean(turn) &&
        typeof turn === "object" &&
        turn !== null &&
        ((turn as HistoryTurn).role === "user" ||
          (turn as HistoryTurn).role === "assistant") &&
        typeof (turn as HistoryTurn).content === "string" &&
        (turn as HistoryTurn).content.trim().length > 0
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((turn) => ({
      role: turn.role,
      content: turn.content.trim().slice(0, MAX_HISTORY_CONTENT_LENGTH),
    }));
};

/**
 * Build text for pgvector intent routing on follow-ups.
 * Uses recent turns + the latest question so vague prompts route correctly.
 */
const buildIntentQuery = (
  question: string,
  history: HistoryTurn[] = []
): string => {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    return trimmedQuestion;
  }

  if (!history?.length) {
    return trimmedQuestion;
  }

  const recentTurns = history.slice(-4);
  const parts: string[] = [];

  for (const turn of recentTurns) {
    const label = turn.role === "user" ? "User" : "Assistant";
    const snippet = turn.content.trim().slice(0, INTENT_SNIPPET_MAX_CHARS);
    parts.push(`${label}: ${snippet}`);
  }

  parts.push(`User: ${trimmedQuestion}`);

  return parts.join("\n").slice(0, INTENT_CONTEXT_MAX_CHARS);
};

export {
  normalizeChatHistory,
  buildIntentQuery,
  MAX_HISTORY_MESSAGES,
};
