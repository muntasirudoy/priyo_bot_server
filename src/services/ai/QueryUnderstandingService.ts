import { getGeminiClient, isGeminiConfigured } from '../../config/gemini.js';
import { ENV } from '../../config/env.js';
import { MULTILINGUAL_TERM_GROUPS } from '../../constants/index.js';
import { ExpandedQuery } from '../../types/index.js';

export class QueryUnderstandingService {
  private static tokens(text: string): string[] {
    return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  }

  private static localExpand(question: string): ExpandedQuery {
    const terms = new Set(this.tokens(question));
    for (const group of MULTILINGUAL_TERM_GROUPS) {
      if (group.some((term) => question.toLowerCase().includes(term))) group.forEach((term) => terms.add(term));
    }
    return { original: question, standalone: question, variants: [question], keywords: [...terms], entities: [] };
  }

  public static async expand(
    question: string,
    history: { role: string; content: string }[] = []
  ): Promise<ExpandedQuery> {
    const local = this.localExpand(question);
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
History: ${history.slice(-6).map((m) => `${m.role}: ${m.content}`).join('\n') || 'None'}
Question: ${question}`;
      const parsed = JSON.parse((await model.generateContent(prompt)).response.text());
      return {
        original: question,
        standalone: typeof parsed.standalone === 'string' ? parsed.standalone : question,
        variants: [...new Set([question, ...(Array.isArray(parsed.variants) ? parsed.variants : [])])].slice(0, 4),
        keywords: [...new Set([...local.keywords, ...(Array.isArray(parsed.keywords) ? parsed.keywords : [])])].slice(0, 30),
        entities: Array.isArray(parsed.entities) ? parsed.entities.filter((x: unknown) => typeof x === 'string').slice(0, 10) : [],
      };
    } catch (error) {
      console.warn('Query expansion failed; using local multilingual expansion.', error);
      return local;
    }
  }
}
