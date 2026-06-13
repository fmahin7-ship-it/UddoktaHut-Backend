import { OLLAMA_BASE_URL } from "./client.js";

const isChatHealthy = async () => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/version`);
    return response.ok;
  } catch {
    return false;
  }
};

export { isChatHealthy };
