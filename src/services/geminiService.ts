import { AIResponse } from "../types";

const responseCache = new Map<string, AIResponse>();
const inFlightRequests = new Map<string, Promise<AIResponse>>();

export async function analyzeQuestion(
  text?: string,
  imageBase64?: string,
  mimeType?: string
): Promise<AIResponse> {
  const normalizedText = text?.trim().toLowerCase();
  const cacheKey = !imageBase64 && normalizedText ? `text:${normalizedText}` : null;

  if (cacheKey) {
    const cached = responseCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const existingRequest = inFlightRequests.get(cacheKey);
    if (existingRequest) {
      return existingRequest;
    }
  }

  const requestPromise = (async () => {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        imageBase64,
        mimeType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with status ${response.status}`);
    }

    const data = (await response.json()) as AIResponse;
    if (cacheKey) {
      if (responseCache.size >= 50) {
        const oldestKey = responseCache.keys().next().value;
        if (oldestKey) responseCache.delete(oldestKey);
      }
      responseCache.set(cacheKey, data);
    }
    return data;
  })();

  if (cacheKey) {
    inFlightRequests.set(cacheKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  }

  return await requestPromise;
}
