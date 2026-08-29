import { runCopilot } from "./runCopilot.js";

const processCopilotStream = (question, storeName, { history = [] } = {}) =>
  runCopilot(question, storeName, { collectAnswer: false, history });

export { processCopilotStream };
