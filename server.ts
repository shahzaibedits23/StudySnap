import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Support base64 image uploads up to 50MB
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Cached server-side Gemini client with required User-Agent telemetry
let cachedAiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("MISSING_GEMINI_API_KEY");
  }
  if (!cachedAiClient) {
    cachedAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return cachedAiClient;
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Fastest reliable free-tier model first, with fallback
const CANDIDATE_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-4-hydrogen",
];

const TUTOR_SYSTEM_INSTRUCTION = `You are a friendly, clear, and encouraging AI tutor.
Explain concepts simply and intuitively before introducing technical terms.
Keep every section crisp, high-signal, and easy to scan—no filler.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    directAnswer: { type: Type.STRING },
    keyTakeaways: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    explanation: { type: Type.STRING },
    stepByStep: { type: Type.STRING },
    eli10: { type: Type.STRING },
    commonMistakes: { type: Type.STRING },
    quizzes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          correctAnswerIndex: { type: Type.INTEGER },
          explanation: { type: Type.STRING },
          difficulty: { type: Type.STRING },
        },
        required: ["question", "options", "correctAnswerIndex", "explanation", "difficulty"],
      },
    },
    relatedTopics: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    diagram: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING },
        title: { type: Type.STRING },
        code: { type: Type.STRING },
        description: { type: Type.STRING },
      },
      required: ["type", "title", "code", "description"],
    },
  },
  required: ["explanation", "stepByStep", "eli10", "quizzes", "relatedTopics"],
};

function isNonRetryableAuthError(err: any): boolean {
  const msg = (err?.message || String(err)).toUpperCase();
  return (
    msg.includes("MISSING_GEMINI_API_KEY") ||
    msg.includes("API_KEY_INVALID") ||
    msg.includes("API KEY NOT VALID") ||
    msg.includes("PERMISSION_DENIED")
  );
}

async function generateWithTimeout(ai: GoogleGenAI, params: any, timeoutMs = 20000) {
  return await Promise.race([
    ai.models.generateContent(params),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI request timed out")), timeoutMs)
    ),
  ]);
}

async function executeGeminiWithFallback(parts: any[]) {
  const ai = getGeminiClient();
  let lastError: any = null;

  // Primary: Structured JSON with Schema
  for (const model of CANDIDATE_MODELS) {
    try {
      const config: any = {
        systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        thinkingConfig: {
          thinkingLevel:
            model === "gemini-3.1-flash-lite" ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW,
        },
      };

      const response = await generateWithTimeout(ai, {
        model,
        contents: { parts },
        config,
      });

      return { response, modelUsed: model, isGrounded: false };
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini] Direct attempt on ${model} failed: ${(err?.message || String(err)).substring(0, 160)}`);
      if (isNonRetryableAuthError(err)) {
        throw err;
      }
    }
  }

  // Resilient Schema-Free Fallback
  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await generateWithTimeout(ai, {
        model,
        contents: { parts },
        config: {
          systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
        },
      });

      return { response, modelUsed: model, isGrounded: false };
    } catch (err: any) {
      lastError = err;
      if (isNonRetryableAuthError(err)) {
        throw err;
      }
    }
  }

  throw lastError;
}

// Question analysis endpoint
app.post("/api/analyze", async (req, res) => {
  try {
    const { text, imageBase64, mimeType } = req.body;

    if (!text && !imageBase64) {
      return res.status(400).json({ error: "Either text or imageBase64 is required." });
    }

    const parts: any[] = [];
    if (imageBase64 && mimeType) {
      parts.push({
        inlineData: {
          data: imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64,
          mimeType: mimeType,
        },
      });
    }

    if (text) {
      parts.push({ text });
    }

    parts.push({
      text: `Analyze this study question, problem, or topic and return concise, crystal-clear JSON:
1. directAnswer: 1-2 sentence direct answer or core takeaway.
2. keyTakeaways: 3 short bullet points summarizing the core ideas.
3. explanation: Clear Markdown conceptual overview (big-picture intuition first, plain-language definitions, bullet points).
4. stepByStep: Numbered Markdown steps (**Step 1: ...**) explaining what to do and why.
5. eli10: Short, memorable "Explain Like I'm 10" analogy.
6. commonMistakes: Brief guide to common traps and how to avoid them.
7. quizzes: 4 to 5 targeted MCQs spanning Easy, Medium, and Hard difficulty. Each item has question, 4 plausible options, 0-based correctAnswerIndex, difficulty ('Easy'|'Medium'|'Hard'), and a concise 1-2 sentence explanation.
8. relatedTopics: 3 related beginner-friendly follow-up topics.
9. diagram: Include whenever helpful for processes, cycles, flows, or relationships:
   - type ('flowchart'|'mindmap'|'sequence'|'cycle'|'concept_map'), title, valid Mermaid.js code (quote labels with punctuation, e.g. A["Step (1)"] --> B["Next"]), and 1-sentence description.`,
    });

    const { response, modelUsed, isGrounded } = await executeGeminiWithFallback(parts);

    const rawText = response.text?.trim() || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        try {
          parsed = JSON.parse(match[1]);
        } catch {
          parsed = {};
        }
      }
    }

    const normalized = {
      directAnswer: typeof parsed.directAnswer === "string" ? parsed.directAnswer : undefined,
      keyTakeaways: Array.isArray(parsed.keyTakeaways)
        ? parsed.keyTakeaways.filter((item: unknown) => typeof item === "string")
        : undefined,
      explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
      stepByStep: typeof parsed.stepByStep === "string" ? parsed.stepByStep : "",
      eli10: typeof parsed.eli10 === "string" ? parsed.eli10 : "",
      commonMistakes: typeof parsed.commonMistakes === "string" ? parsed.commonMistakes : undefined,
      quizzes: Array.isArray(parsed.quizzes)
        ? parsed.quizzes.filter(
            (q: any) =>
              q &&
              typeof q.question === "string" &&
              Array.isArray(q.options) &&
              typeof q.correctAnswerIndex === "number"
          )
        : [],
      relatedTopics: Array.isArray(parsed.relatedTopics)
        ? parsed.relatedTopics.filter((item: unknown) => typeof item === "string")
        : [],
      diagram:
        parsed.diagram &&
        typeof parsed.diagram === "object" &&
        typeof parsed.diagram.code === "string" &&
        parsed.diagram.code.trim().length > 0
          ? {
              type: typeof parsed.diagram.type === "string" ? parsed.diagram.type : "flowchart",
              title: typeof parsed.diagram.title === "string" ? parsed.diagram.title : "Concept Diagram",
              code: parsed.diagram.code,
              description:
                typeof parsed.diagram.description === "string" ? parsed.diagram.description : undefined,
            }
          : undefined,
    };

    // Extract Google Search grounding metadata if present
    const candidate = response.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;
    const searchQueries: string[] = groundingMetadata?.webSearchQueries || [];
    const searchSources: { title: string; url: string }[] = [];

    if (groundingMetadata?.groundingChunks) {
      const seenUrls = new Set<string>();
      for (const chunk of groundingMetadata.groundingChunks) {
        if (chunk.web?.uri && !seenUrls.has(chunk.web.uri)) {
          seenUrls.add(chunk.web.uri);
          searchSources.push({
            title: chunk.web.title || new URL(chunk.web.uri).hostname,
            url: chunk.web.uri,
          });
        }
      }
    }

    return res.json({
      ...normalized,
      modelUsed,
      isGrounded,
      searchSources: searchSources.length > 0 ? searchSources : undefined,
      searchQueries: searchQueries.length > 0 ? searchQueries : undefined,
    });
  } catch (error: any) {
    console.error("Final error analyzing question in server:", error);
    const errMsg = error?.message || String(error);
    const upperMsg = errMsg.toUpperCase();

    if (upperMsg.includes("MISSING_GEMINI_API_KEY")) {
      return res.status(500).json({
        error: "Server AI configuration is missing. Please check Settings > Secrets.",
      });
    }

    if (
      upperMsg.includes("API_KEY_INVALID") ||
      upperMsg.includes("API KEY NOT VALID") ||
      upperMsg.includes("PERMISSION_DENIED")
    ) {
      return res.status(403).json({
        error: "Server AI key is invalid or unauthorized. Please check Settings > Secrets.",
      });
    }

    const is429 = errMsg.includes("429") || upperMsg.includes("RESOURCE_EXHAUSTED") || upperMsg.includes("QUOTA");
    if (is429) {
      return res.status(429).json({
        error: "AI service rate limit reached. Please wait a few moments and try again.",
        isRateLimit: true,
      });
    }

    const is503 = errMsg.includes("503") || upperMsg.includes("UNAVAILABLE") || upperMsg.includes("HIGH DEMAND");
    if (is503) {
      return res.status(503).json({
        error: "AI service is temporarily experiencing high demand. Please try again in a moment.",
      });
    }

    return res.status(500).json({
      error: "Failed to analyze question. Please try again.",
    });
  }
});

// Vite middleware for development and static serving for production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
