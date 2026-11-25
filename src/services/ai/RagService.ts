import { getGeminiClient, isGeminiConfigured } from '../../config/gemini.js';
import { ENV } from '../../config/env.js';
import { BotSettingsData, ChatIntent, StructuredAiResponse, VectorSearchResult } from '../../types/index.js';
import { getBotSettings } from '../../models/BotSettings.js';
import { UnansweredQuery } from '../../models/UnansweredQuery.js';
import { Types } from 'mongoose';
import { HUMAN_ESCALATION_PHRASES } from '../../constants/index.js';

export class RagService {
  public static isHumanEscalationRequested(message: string): boolean { return HUMAN_ESCALATION_PHRASES.some((phrase) => message.toLowerCase().includes(phrase)); }
  public static retrievalConfidence(chunks: VectorSearchResult[]): number {
    return Math.max(0, ...chunks.map((c) => Math.max(c.similarityScore, c.lexicalScore ?? 0, c.rerankerScore ?? 0)));
  }
  public static async generateAnswer(
    userQuestion: string, chunks: VectorSearchResult[], history: { role: string; content: string }[] = [],
    intent: ChatIntent = 'KNOWLEDGE_QUERY', identity?: { userEmail: string; conversationId: Types.ObjectId },
    settings?: BotSettingsData,
  ): Promise<StructuredAiResponse> {
    const config = settings ?? await getBotSettings();
    if (intent === 'HUMAN_NEEDED') return { answer: 'I hear you. I’ve asked our support team to take over this chat and follow up at your email.', confidence: 'high', needsHuman: true };
    if (intent === 'CHITCHAT') {
      const bangla = /[\u0980-\u09ff]/.test(userQuestion);
      const thanks = /thank|ধন্যবাদ|dhonnobad/i.test(userQuestion);
      return { answer: bangla ? (thanks ? 'আপনাকে স্বাগতম! আর কিছুতে সাহায্য করতে পারি?' : 'হ্যালো! কীভাবে সাহায্য করতে পারি?') : (thanks ? 'You’re welcome! Anything else I can help with?' : 'Hi! What can I help you with?'), confidence: 'high', needsHuman: false };
    }
    const score = this.retrievalConfidence(chunks);
    if (score < config.confidenceThreshold) {
      if (identity) await UnansweredQuery.create({ query: userQuestion, userEmail: identity.userEmail, conversationId: identity.conversationId });
      return { answer: config.fallbackMessage, confidence: 'low', needsHuman: false };
    }
    if (!isGeminiConfigured()) return { answer: chunks[0].content.slice(0, 350), confidence: 'medium', needsHuman: false };
    try {
      const model = getGeminiClient().getGenerativeModel({ model: ENV.GEMINI_TEXT_MODEL, generationConfig: { temperature: 0.35, responseMimeType: 'application/json' } });
      const context = chunks.slice(0, 6).map((c) => c.content).join('\n\n');
      const prompt = `You are ${config.botName}, a ${config.tone} customer support person. Answer only from the supplied support knowledge. Never invent policies, prices, or promises. Write 2–4 concise conversational sentences in the customer's English, Bangla, or Banglish style. Avoid AI clichés such as "Certainly!", "Great question!", "Based on the provided document", and long lists. When evidence is incomplete, ask one natural clarifying question or offer a support team follow-up at their email. Return JSON: {"answer":"...","confidence":"high|medium|low","needsHuman":false}.
Knowledge:\n${context}\nRecent chat:\n${history.slice(-5).map((m) => `${m.role}: ${m.content}`).join('\n')}\nCustomer: ${userQuestion}`;
      const raw = (await model.generateContent(prompt)).response.text().replace(/^```json\s*|^```\s*|```$/g, '').trim();
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && 'answer' in parsed && typeof parsed.answer === 'string' && parsed.answer.trim()) {
        const result = parsed as { answer: string; confidence?: string; needsHuman?: boolean };
        return { answer: result.answer.trim(), confidence: result.confidence === 'high' || result.confidence === 'low' ? result.confidence : 'medium', needsHuman: Boolean(result.needsHuman) };
      }
    } catch (error) { console.warn('Answer generation failed:', error); }
    return { answer: config.fallbackMessage, confidence: 'low', needsHuman: false };
  }
}
