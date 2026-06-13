import { env } from "../../../config/env.js";

const OLLAMA_BASE_URL = env.OLLAMA_URL || "http://localhost:11434";
const CHAT_MODEL = env.OLLAMA_CHAT_MODEL || "llama3.1:8b";
const EMBEDDING_MODEL = env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";

export { OLLAMA_BASE_URL, CHAT_MODEL, EMBEDDING_MODEL };
