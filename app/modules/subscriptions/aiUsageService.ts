import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { aiUsageMonthly } from "../../db/schema/index.ts";
import { SUBSCRIPTION_ERROR_CODES } from "../../constants/plans.ts";
import { throwAppError } from "../../lib/appError.ts";

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

const getMonthlyAiUsage = async (
  storeId: number,
  period = currentUsagePeriod()
) => {
  const row = await db.query.aiUsageMonthly.findFirst({
    where: and(
      eq(aiUsageMonthly.store_id, storeId),
      eq(aiUsageMonthly.period, period)
    ),
    columns: { tokens_used: true },
  });

  return row?.tokens_used ?? 0;
};

const getAiUsageSummary = async (storeId: number, tokenLimit: number) => {
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
}: {
  storeId: number;
  includesAi: boolean;
  tokenLimit: number;
  question?: string;
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
  storeId: number,
  tokens: number,
  period = currentUsagePeriod()
) => {
  if (!tokens || tokens <= 0) return;

  await db.transaction(async (tx) => {
    let row = await tx.query.aiUsageMonthly.findFirst({
      where: and(
        eq(aiUsageMonthly.store_id, storeId),
        eq(aiUsageMonthly.period, period)
      ),
    });

    if (!row) {
      const inserted = await tx
        .insert(aiUsageMonthly)
        .values({ store_id: storeId, period, tokens_used: 0 })
        .returning();
      row = inserted[0];
    }

    if (!row) return;

    const [locked] = await tx
      .select()
      .from(aiUsageMonthly)
      .where(eq(aiUsageMonthly.id, row.id))
      .for("update");

    if (!locked) return;

    await tx
      .update(aiUsageMonthly)
      .set({
        tokens_used: locked.tokens_used + tokens,
        updated_at: new Date(),
      })
      .where(eq(aiUsageMonthly.id, locked.id));
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
