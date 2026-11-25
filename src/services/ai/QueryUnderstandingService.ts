import { getGeminiClient, isGeminiConfigured } from '../../config/gemini.js';
import { ENV } from '../../config/env.js';
import { MULTILINGUAL_TERM_GROUPS } from '../../constants/index.js';
import { ExpandedQuery, ChatIntent } from '../../types/index.js';

export class QueryUnderstandingService {
  public static classifyIntent(message: string): ChatIntent {
    const text = message.toLowerCase().trim();
    if (/\b(human|agent|representative|real person|escalat|complain|frustrat|refund|supervisor)\b|মানুষ|এজেন্ট|রিফান্ড|ফেরত|manush|agent chai/i.test(text)) return 'HUMAN_NEEDED';
    if (/^(hi|hello|hey|thanks|thank you|bye|good morning|good evening|how are you|assalamu alaikum|salam|ধন্যবাদ|হ্যালো|কেমন আছো)[!?.\s]*$/i.test(text)) return 'CHITCHAT';
    return 'KNOWLEDGE_QUERY';
  }
  private static tokens(text: string): string[] {
    return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  }

  private static localExpand(question: string, history: { role: string; content: string }[] = []): ExpandedQuery {
    let standalone = question;
    const asksAboutWork = /\b(company|employer|work|works|working|currently|job|kaj|chakri|kore|korche)\b|কোম্পানি|কাজ|চাকরি/i.test(question);
    const prior = [...history].reverse().filter((item) => item.role === 'USER').map((item) => item.content.match(/\b([\p{L}]{3,})\s+(?:k|ke|who|কে)\??/iu)?.[1] || item.content.match(/\bwho\s+is\s+([\p{L}]{3,})/iu)?.[1]).find(Boolean);
    const shortFollowUp = this.tokens(question).length <= 12 && /\b(kon|ki|kothay|kobe|kar|tar|se|uni|who|what|where|when|which|does|his|her|their|he|she)\b|কোন|কোথায়|তার|তিনি/i.test(question);
    if (prior && !question.toLowerCase().includes(prior.toLowerCase()) && (asksAboutWork || shortFollowUp)) {
      standalone = asksAboutWork ? `${prior} current company employer workplace` : `${prior} ${question}`;
    }
    const terms = new Set(this.tokens(standalone));
    for (const group of MULTILINGUAL_TERM_GROUPS) {
      if (group.some((term) => question.toLowerCase().includes(term))) group.forEach((term) => terms.add(term));
    }
    const subject = standalone !== question ? standalone.split(' ')[0] : '';
    return { original: question, standalone, variants: standalone !== question ? (asksAboutWork ? [question, standalone, `${subject} company`] : [question, standalone]) : [question], keywords: [...terms], entities: subject ? [subject] : [] };
  }

  public static async expand(
    question: string,
    history: { role: string; content: string }[] = []
  ): Promise<ExpandedQuery> {
    const local = this.localExpand(question, history);
    if (local.standalone !== question) return local;
    if (!isGeminiConfigured()) return local;
    try {
      const model = getGeminiClient().getGenerativeModel({
        model: ENV.GEMINI_TEXT_MODEL,
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      });
      const prompt = `Rewrite the latest customer question as a standalone knowledge-base search query.
Support Bangla, English and romanized Banglish. Return JSON only:
{"standalone":"","variants":["English semantic rewrite","Bangla semantic rewrite"],"keywords":[],"entities":[]}
Do not answer the question and do not invent named entities.
History: ${history.slice(-5).map((m) => `${m.role}: ${m.content}`).join('\n') || 'None'}
Question: ${question}`;
      const parsed = JSON.parse((await model.generateContent(prompt)).response.text());
      return {
        original: question,
        standalone: typeof parsed.standalone === 'string' && parsed.standalone.trim() ? parsed.standalone : local.standalone,
        variants: [...new Set([...local.variants, ...(Array.isArray(parsed.variants) ? parsed.variants : [])])].slice(0, 5),
        keywords: [...new Set([...local.keywords, ...(Array.isArray(parsed.keywords) ? parsed.keywords : [])])].slice(0, 30),
        entities: Array.isArray(parsed.entities) ? parsed.entities.filter((x: unknown) => typeof x === 'string').slice(0, 10) : [],
      };
    } catch (error) {
      console.warn('Query expansion failed; using local multilingual expansion.', error);
      return local;
    }
  }
}
