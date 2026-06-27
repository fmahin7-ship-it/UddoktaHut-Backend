/**
 * Seed intent utterances into tool_routing (embeddings via OpenAI).
 *
 * Usage:
 *   npm run seed-intent-utterances
 *   npm run seed-intent-utterances -- --replace
 *
 * Requires: migration run, OPENAI_API_KEY, pgvector extension.
 */
import dotenv from "dotenv";
import { generateEmbedding } from "../app/services/ai/provider.js";
import { INTENT_UTTERANCES } from "../app/services/ai/intent/utterances/intentUtterances.js";
import {
  clearIntentUtterances,
  countIntentUtterances,
  insertIntentUtterance,
} from "../app/services/ai/intent/intentVectorStore.js";
import { sequelize } from "../app/config/database.js";

dotenv.config();

const replace = process.argv.includes("--replace");

const seedIntentUtterances = async () => {
  try {
    await sequelize.authenticate();
    console.log("DB connected");

    const existing = await countIntentUtterances();
    if (existing > 0 && !replace) {
      console.log(
        `tool_routing already has ${existing} utterances. Use --replace to re-seed.`
      );
      return;
    }

    if (replace && existing > 0) {
      await clearIntentUtterances();
      console.log("Cleared existing intent utterances");
    }

    console.log(`Seeding ${INTENT_UTTERANCES.length} intent utterances...`);

    for (const utterance of INTENT_UTTERANCES) {
      const embedding = await generateEmbedding(utterance.example_question);
      await insertIntentUtterance({
        example_question: utterance.example_question,
        tool_name: utterance.tool_name,
        locale: utterance.locale,
        embedding,
      });
      console.log(`  ✓ ${utterance.tool_name}: "${utterance.example_question}"`);
    }

    const total = await countIntentUtterances();
    console.log(`Done. ${total} utterances in tool_routing.`);
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

seedIntentUtterances();
