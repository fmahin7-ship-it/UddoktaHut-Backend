/**
 * Golden-set eval runner for the store AI copilot.
 *
 * Usage:
 *   npm run ai:eval
 *   EVAL_STORE_NAME=my-store npm run ai:eval
 *   npm run ai:eval -- --min-pass=90
 */
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sequelize } from "../app/config/database.js";
import { Store } from "../app/models/RootModel.js";
import { runCopilot } from "../app/services/ai/copilot/runCopilot.js";
import { scoreCase } from "../app/services/ai/evals/scoreCase.js";
import { checkAIServices } from "../app/services/ai/aiService.js";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const goldenPath = join(
  __dirname,
  "../app/services/ai/evals/golden/routing.json"
);

const parseMinPass = () => {
  const arg = process.argv.find((item) => item.startsWith("--min-pass="));
  if (!arg) return 85;
  const value = Number(arg.slice("--min-pass=".length));
  return Number.isFinite(value) ? value : 85;
};

const resolveStoreName = async () => {
  if (process.env.EVAL_STORE_NAME?.trim()) {
    return process.env.EVAL_STORE_NAME.trim();
  }

  const store = await Store.findOne({ order: [["id", "ASC"]] });
  if (!store) {
    throw new Error(
      "No store found. Complete onboarding and seed products first."
    );
  }

  return store.store_name;
};

async function main() {
  const minPass = parseMinPass();
  const golden = JSON.parse(readFileSync(goldenPath, "utf8"));

  await sequelize.authenticate();

  const services = await checkAIServices();
  if (!services.available) {
    throw new Error(`AI services unavailable: ${services.error}`);
  }

  const storeName = await resolveStoreName();

  console.log(`\nAI Eval — store: "${storeName}"`);
  console.log(`Provider: ${services.provider}`);
  console.log(`Cases: ${golden.cases.length}\n`);

  const results = [];

  for (const testCase of golden.cases) {
    process.stdout.write(`  ${testCase.id} ... `);

    const copilotResult = await runCopilot(testCase.question, storeName, {
      collectAnswer: true,
    });

    const scored = scoreCase(testCase, copilotResult);
    results.push(scored);

    if (scored.pass) {
      console.log("PASS");
    } else {
      console.log("FAIL");
      console.log(`    reason: ${scored.reason}`);
      console.log(`    actual: ${JSON.stringify(scored.actual)}`);
      if (scored.expected) {
        console.log(`    expected: ${JSON.stringify(scored.expected)}`);
      }
    }
  }

  const passed = results.filter((result) => result.pass).length;
  const total = results.length;
  const rate = Math.round((passed / total) * 100);

  console.log(`\nScore: ${passed}/${total} (${rate}%)`);
  console.log(`Minimum pass rate: ${minPass}%\n`);

  await sequelize.close();

  if (rate < minPass) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error("Eval run failed:", error.message);
  try {
    await sequelize.close();
  } catch {
    // ignore
  }
  process.exit(1);
});
