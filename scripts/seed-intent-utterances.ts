/**
 * Seed intent utterances into tool_routing (embeddings via OpenAI).
 */
import dotenv from "dotenv";
import { generateEmbedding } from "../app/modules/ai/provider.ts";
import { INTENT_UTTERANCES } from "../app/modules/ai/intent/utterances/intentUtterances.ts";
import {
  clearIntentUtterances,
  countIntentUtterances,
  insertIntentUtterance,
} from "../app/modules/ai/intent/intentVectorStore.ts";
import { connectDatabase, pool } from "../app/db/client.ts";

dotenv.config();

const replace = process.argv.includes("--replace");

const seedIntentUtterances = async () => {
  try {
    await connectDatabase();
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
    const message = error instanceof Error ? error.message : String(error);
    console.error("Seed failed:", message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

seedIntentUtterances();
