import { GoogleGenAI } from "@google/genai";
import { config } from "../config";

const EMBEDDING_DIM = 768;
const MODEL = "models/gemini-embedding-001";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = config.gemini.apiKey;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is required for embeddings. Get one at https://aistudio.google.com/apikey"
      );
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/**
 * Generate embedding for a document (use when indexing knowledge base entries).
 * Task type RETRIEVAL_DOCUMENT optimizes for corpus indexing.
 */
export async function embedDocument(text: string): Promise<number[]> {
  const ai = getClient();
  const response = await ai.models.embedContent({
    model: MODEL,
    contents: text,
    config: {
      outputDimensionality: EMBEDDING_DIM,
      taskType: "RETRIEVAL_DOCUMENT",
    },
  });
  const emb = response.embeddings?.[0];
  if (!emb?.values?.length) {
    throw new Error("No embedding returned from Gemini");
  }
  return emb.values as number[];
}

/**
 * Generate embedding for a search query (use when retrieving).
 * Task type RETRIEVAL_QUERY optimizes for query matching.
 */
export async function embedQuery(query: string): Promise<number[]> {
  const ai = getClient();
  const response = await ai.models.embedContent({
    model: MODEL,
    contents: query,
    config: {
      outputDimensionality: EMBEDDING_DIM,
      taskType: "RETRIEVAL_QUERY",
    },
  });
  const emb = response.embeddings?.[0];
  if (!emb?.values?.length) {
    throw new Error("No embedding returned from Gemini");
  }
  return emb.values as number[];
}

export { EMBEDDING_DIM };
