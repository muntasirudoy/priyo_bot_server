import { getGeminiClient, isGeminiConfigured } from '../../config/gemini.js';
import { ENV } from '../../config/env.js';
import { RAG_CONFIG, HUMAN_ESCALATION_PHRASES } from '../../constants/index.js';
import { StructuredAiResponse, VectorSearchResult } from '../../types/index.js';

export interface ChatHistoryMessage {
  role: 'user' | 'model';
  parts: string;
}

export class RagService {
  private static get modelName() {
    return ENV.GEMINI_TEXT_MODEL;
  }

  /**
   * Checks if user message explicitly requests human escalation.
   */
  public static isHumanEscalationRequested(messageText: string): boolean {
    const lower = messageText.toLowerCase().trim();
    return HUMAN_ESCALATION_PHRASES.some((phrase) => lower.includes(phrase));
  }

  /**
   * Builds the strict grounding prompt and calls Gemini Text Model.
   */
  public static async generateAnswer(
    userQuestion: string,
    retrievedChunks: VectorSearchResult[],
    recentHistory: { role: string; content: string }[] = []
  ): Promise<StructuredAiResponse> {
    // 1. Explicit human escalation check
    const wantsHuman = this.isHumanEscalationRequested(userQuestion);
    if (wantsHuman) {
      return {
        answer: 'I have flagged your request for a human support representative. An agent will be with you shortly.',
        confidence: 'high',
        needsHuman: true,
      };
    }

    // 2. If no chunks found above threshold, do not hallucinate
    if (!retrievedChunks || retrievedChunks.length === 0) {
      return {
        answer: RAG_CONFIG.NO_INFO_FALLBACK,
        confidence: 'low',
        needsHuman: false,
      };
    }

    // 3. Fallback when Gemini is not configured
    if (!isGeminiConfigured()) {
      console.warn('⚠️ Gemini API key not configured. Generating grounded answer from top chunk.');
      const topChunk = retrievedChunks[0];
      return {
        answer: `Based on ${topChunk.documentName} (Page ${topChunk.pageNumber}):\n\n${topChunk.content.slice(0, 300)}...`,
        confidence: 'medium',
        needsHuman: false,
      };
    }

    try {
      const client = getGeminiClient();
      console.log(`🤖 Calling Gemini Text Model (${this.modelName}) for grounded answer generation...`);
     
      const model = client.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          temperature: 0.2, // Low temperature for high factual grounding
          responseMimeType: 'application/json',
        },
      });

      // Construct context from retrieved chunks
      const contextBlocks = retrievedChunks
        .map(
          (c, idx) =>
            `[Source ${idx + 1}: ${c.documentName} | Page: ${c.pageNumber}]\n${c.content}`
        )
        .join('\n\n---\n\n');

      const historyFormatted = recentHistory
        .slice(-RAG_CONFIG.MAX_CONTEXT_MESSAGES)
        .map((m) => `${m.role === 'USER' ? 'Customer' : 'Assistant'}: ${m.content}`)
        .join('\n');

      const prompt = `
You are a customer support AI assistant.
Your job is to answer the customer's question using ONLY the information provided in the retrieved knowledge base context below.
Do not invent information.
Do not assume information that is not present.
If the answer cannot be determined from the provided context, clearly say: "${RAG_CONFIG.NO_INFO_FALLBACK}".
Do not fabricate prices, policies, delivery times, product information, guarantees, or company information.
Keep answers concise, clear, and helpful.
If the user indicates frustration or explicitly asks to speak to someone, set needsHuman to true.

Output your answer strictly in the following JSON format:
{
  "answer": "Grounded answer text here",
  "confidence": "high" | "medium" | "low",
  "needsHuman": false | true
}

--- RETRIEVED KNOWLEDGE BASE CONTEXT ---
${contextBlocks}

--- RECENT CONVERSATION HISTORY ---
${historyFormatted || 'None'}

--- CURRENT CUSTOMER QUESTION ---
${userQuestion}
`;

      const response = await model.generateContent(prompt);
      const rawText = response.response.text();

      return this.parseAndValidateResponse(rawText);
    } catch (error) {
      console.error('❌ Error calling Gemini Text Model:', error);
      // Fallback gracefully without crashing
      return {
        answer: 'I am currently having difficulty retrieving an answer. Please try again or ask to speak to human support.',
        confidence: 'low',
        needsHuman: false,
      };
    }
  }

  /**
   * Safely parses and validates structured JSON response from Gemini.
   * If parsing fails, cleanly falls back without throwing.
   */
  private static parseAndValidateResponse(rawText: string): StructuredAiResponse {
    try {
      // Strip markdown code fences if present (e.g. ```json ... ```)
      const cleaned = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/```\s*$/, '')
        .trim();

      const parsed = JSON.parse(cleaned);

      if (typeof parsed.answer === 'string' && parsed.answer.trim().length > 0) {
        return {
          answer: parsed.answer.trim(),
          confidence: ['high', 'medium', 'low'].includes(parsed.confidence)
            ? parsed.confidence
            : 'medium',
          needsHuman: Boolean(parsed.needsHuman),
        };
      }
    } catch {
      // JSON parse failed; fallback to raw text
    }

    return {
      answer: rawText.replace(/```json/g, '').replace(/```/g, '').trim(),
      confidence: 'medium',
      needsHuman: false,
    };
  }
}
