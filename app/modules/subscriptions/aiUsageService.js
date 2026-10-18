import { sequelize } from "../../models/RootModel.js";
import AiUsageMonthly from "../../models/AiUsageMonthly.js";
import { SUBSCRIPTION_ERROR_CODES } from "../../constants/plans.js";
import { throwAppError } from "../../lib/appError.js";

const currentUsagePeriod = (date = new Date()) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

/** Rough token estimate — ~4 characters per token (OpenAI rule of thumb). */
const estimateTokens = (text = "") => {
  if (!text || typeof text !== "string") return 0;
  return Math.max(1, Math.ceil(text.trim().length / 4));
};

const getMonthlyAiUsage = async (storeId, period = currentUsagePeriod()) => {
  const row = await AiUsageMonthly.findOne({
    where: { store_id: storeId, period },
    attributes: ["tokens_used"],
  });

  return row?.tokens_used ?? 0;
};

const getAiUsageSummary = async (storeId, tokenLimit) => {
  const period = currentUsagePeriod();
  const used = await getMonthlyAiUsage(storeId, period);

  return {
    period,
    used,
    limit: tokenLimit,
    remaining: Math.max(tokenLimit - used, 0),
  };
};

const assertCanUseAi = async ({
  storeId,
  includesAi,
  tokenLimit,
  question = "",
}) => {
  if (!includesAi) {
    throwAppError(
      "AI Business Analytics requires a Pro or Business plan.",
      403,
      SUBSCRIPTION_ERROR_CODES.AI_PLAN_REQUIRED
    );
  }

  const usage = await getAiUsageSummary(storeId, tokenLimit);
  const estimated = estimateTokens(question);

  if (usage.used + estimated > usage.limit) {
    throwAppError(
      `Monthly AI token limit reached (${usage.used}/${usage.limit}). Upgrade or wait until next billing period.`,
      403,
      SUBSCRIPTION_ERROR_CODES.AI_TOKEN_LIMIT_EXCEEDED,
      usage
    );
  }

  return { ...usage, estimated };
};

const recordAiTokenUsage = async (
  storeId,
  tokens,
  period = currentUsagePeriod()
) => {
  if (!tokens || tokens <= 0) return;

  await sequelize.transaction(async (transaction) => {
    const [row] = await AiUsageMonthly.findOrCreate({
      where: { store_id: storeId, period },
      defaults: { tokens_used: 0, updated_at: new Date() },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    await row.increment("tokens_used", { by: tokens, transaction });
    row.updated_at = new Date();
    await row.save({ transaction });
  });
};

export {
  assertCanUseAi,
  currentUsagePeriod,
  estimateTokens,
  getAiUsageSummary,
  getMonthlyAiUsage,
  recordAiTokenUsage,
};
