import { getOpenAIClient } from "./client.ts";

const isChatHealthy = async (): Promise<boolean> => {
  try {
    await getOpenAIClient().models.list();
    return true;
  } catch {
    return false;
  }
};

export { isChatHealthy };
