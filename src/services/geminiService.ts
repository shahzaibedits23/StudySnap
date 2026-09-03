import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeQuestion(text?: string, imageBase64?: string, mimeType?: string) {
  const parts: any[] = [];
  if (imageBase64 && mimeType) {
    parts.push({
      inlineData: {
        data: imageBase64.split(',')[1] || imageBase64,
        mimeType: mimeType
      }
    });
  }
  if (text) {
    parts.push({ text });
  }
  
  parts.push({
    text: `Analyze the provided study question, problem, diagram, or topic.
Your mission is to make the explanation so crystal-clear, friendly, and intuitive that ANY student—regardless of background—can easily understand and master it.

Provide your response in JSON matching this schema:
1. directAnswer: A concise, friendly, 1-2 sentence direct solution or takeaway. Avoid confusing jargon.
2. keyTakeaways: Exactly 3 to 4 easy-to-remember bullet points highlighting the main ideas in simple words.
3. explanation: A crystal-clear conceptual explanation in Markdown:
   - Start with the "big picture" intuition before diving into details.
   - If technical terms are used, immediately explain them in plain language in parentheses.
   - Use friendly bullet points, bold key ideas, and formatting to keep it inviting and effortless to read.
4. stepByStep: A step-by-step walkthrough where each step is clearly numbered and labeled:
   - State the specific goal of each step (e.g. "**Step 1: Identify what we have and what we need**").
   - Explain *why* we do each step, not just the raw arithmetic or facts.
   - Make the math / reasoning step transitions super obvious and easy to follow.
5. eli10: An unforgettable "Explain Like I'm 10" real-world story or analogy (e.g., comparing it to video games, pizza slices, toys, sports, or cooking) that makes the abstract concept immediately click.
6. commonMistakes: High-yield tips on common traps and misconceptions: explain *why* people make this mistake and *how* to avoid it.
7. quizzes: Generate an adaptive, high-yield practice quiz of 5 to 8 multiple-choice questions (MCQs) calibrated to the depth and breadth of the given question/topic:
   - For single-concept or focused questions: provide 5 to 6 targeted questions ranging from basic conceptual understanding to direct application and common pitfalls.
   - For broader, multi-step, or complex subjects: provide 6 to 8 questions spanning foundational recall, step-by-step problem solving, tricky edge cases, and higher-order application.
   - Ensure each quiz item has:
     * 4 clear, plausible options (no lazy shortcuts).
     * The 0-based correctAnswerIndex.
     * An accurate difficulty level ('Easy', 'Medium', or 'Hard').
     * A comprehensive, friendly explanation detailing why the correct choice is right and addressing common traps in the distractors.
8. relatedTopics: 3 to 4 related beginner-friendly concepts or follow-up questions.
9. diagram: Provide a visual diagram whenever requested by the user, OR when the topic/concept involves a process, cycle, algorithm, relationship, formula breakdown, system architecture, decision tree, comparison, or chronological sequence.
   - type: The diagram category (e.g. 'flowchart', 'mindmap', 'sequence', 'cycle', 'architecture', 'concept_map').
   - title: A clear descriptive title for the diagram.
   - code: Clean, valid Mermaid.js diagram definition (e.g. starting with 'graph TD', 'flowchart TD', 'flowchart LR', 'mindmap', 'sequenceDiagram', or 'stateDiagram-v2'). Note: wrap node texts containing punctuation or special symbols in quotes, e.g. A["Sunlight (Photons)"] --> B["Chlorophyll Absorption"].
   - description: A concise 1-2 sentence caption explaining what the visual diagram demonstrates.`
  });

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: { parts },
    config: {
      systemInstruction: `You are the world's most friendly, clear, and encouraging personal AI tutor with access to Google Search for live, verified, and up-to-date factual data.
Your superpower is taking complex, intimidating concepts and explaining them with such warmth, clarity, and intuition that anyone—from a middle schooler to an adult learner—can grasp them instantly.
Key principles:
- Always prioritize clarity and simplicity over dense academic terminology.
- Ground your answers in accurate, up-to-date information using Google Search whenever helpful.
- When introducing a technical term or formula, always explain what it means in everyday words first.
- In step-by-step solutions, always explain the reasoning behind each step so the student never feels lost.
- Provide clean, elegant visual Mermaid diagrams for processes, cycles, relationships, and problem-solving flows whenever helpful or requested.
- Be encouraging, positive, and supportive.`,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          directAnswer: { type: Type.STRING },
          keyTakeaways: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          explanation: { type: Type.STRING },
          stepByStep: { type: Type.STRING },
          eli10: { type: Type.STRING },
          commonMistakes: { type: Type.STRING },
          diagram: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              title: { type: Type.STRING },
              code: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ["type", "title", "code", "description"]
          },
          quizzes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                correctAnswerIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
                difficulty: { 
                  type: Type.STRING,
                  enum: ["Easy", "Medium", "Hard"]
                }
              },
              required: ["question", "options", "correctAnswerIndex", "explanation"]
            }
          },
          relatedTopics: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["directAnswer", "keyTakeaways", "explanation", "stepByStep", "eli10", "commonMistakes", "quizzes", "relatedTopics"]
      }
    }
  });

  const jsonStr = response.text?.trim() || "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // If wrapped in markdown code fence
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      try {
        parsed = JSON.parse(match[1]);
      } catch {
        parsed = {};
      }
    }
  }

  // Extract Google Search grounding metadata
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
          url: chunk.web.uri
        });
      }
    }
  }

  return {
    ...parsed,
    searchSources: searchSources.length > 0 ? searchSources : undefined,
    searchQueries: searchQueries.length > 0 ? searchQueries : undefined,
  };
}

