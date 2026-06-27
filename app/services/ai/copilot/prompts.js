import { INTENT_TIERS } from "../intent/constants.js";

const COPILOT_SYSTEM_PROMPT = `You are the UddoktaHut AI Business Copilot for store owners.

RULES:
- Answer ONLY using data returned from tools for store/business questions.
- Call the minimum tools needed. You may call multiple tools for one question.
- Tools cover products, inventory, orders, sales, bestsellers, and returns/refunds.
- For strategy, advice, pricing, or "soon" questions: still call relevant tools first, then explain limits honestly.
- Respond in the SAME language as the user's question (Bengali or English).
- Never invent numbers, products, or store facts not present in tool results.
- Never expose SQL, internal IDs, or raw JSON to the user.
- If a tool returns empty results, say what was checked and offer a helpful next step.
- For off-topic questions, politely say you only help with their store data.

If no tool is needed (greeting, thanks), reply briefly without calling tools.`;

const buildIntentHint = (intentMatches, tier) => {
  if (!intentMatches?.length || tier === INTENT_TIERS.AUTO) {
    return null;
  }

  const lines = intentMatches.map(
    (m) =>
      `- ${m.tool_name} (matched "${m.matched_utterance}", confidence ${m.similarity.toFixed(2)})`
  );

  if (tier === INTENT_TIERS.HIGH) {
    return `Intent resolved (high confidence) — you MUST call one of these tools before answering:\n${lines.slice(0, 1).join("\n")}\nDo not answer from memory.`;
  }

  if (tier === INTENT_TIERS.MEDIUM) {
    return `Intent resolved (medium confidence) — call one of these tools before answering:\n${lines.slice(0, 2).join("\n")}\nDo not answer from memory.`;
  }

  return `Intent resolution — consider calling these tools for this question:\n${lines.join("\n")}\nYou must still call tools to fetch live data; do not answer from memory or this hint alone.`;
};

const buildAutoRunContext = (toolName) =>
  `Store data was already fetched via \`${toolName}\`. Use the tool result in the conversation to answer the user. Do not call the same tool again unless the user asks for different parameters.`;

const buildCopilotMessages = (
  question,
  storeName,
  { intentMatches = [], tier = INTENT_TIERS.FULL } = {}
) => {
  const messages = [{ role: "system", content: COPILOT_SYSTEM_PROMPT }];

  const intentHint = buildIntentHint(intentMatches, tier);
  if (intentHint) {
    messages.push({ role: "system", content: intentHint });
  }

  if (tier === INTENT_TIERS.AUTO) {
    messages.push({
      role: "system",
      content: buildAutoRunContext(intentMatches[0]?.tool_name),
    });
  }

  messages.push({
    role: "user",
    content: `Store: "${storeName}"\n\nQuestion: ${question}`,
  });

  return messages;
};

export {
  COPILOT_SYSTEM_PROMPT,
  buildCopilotMessages,
  buildIntentHint,
  buildAutoRunContext,
};
