import { getOpenAIClient } from "./client.js";

const isChatHealthy = async () => {
  try {
    await getOpenAIClient().models.list({ limit: 1 });
    return true;
  } catch {
    return false;
  }
};

export { isChatHealthy };
