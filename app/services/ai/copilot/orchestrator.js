import { runCopilot } from "./runCopilot.js";

const processCopilotStream = (question, storeName) =>
  runCopilot(question, storeName, { collectAnswer: false });

export { processCopilotStream };
