import { runCopilot } from "./runCopilot.ts";

const processCopilotStream = (
  question: string,
  storeName: string,
  {
    history = [],
  }: { history?: Array<{ role: string; content: string }> } = {}
) => runCopilot(question, storeName, { collectAnswer: false, history });

export { processCopilotStream };
