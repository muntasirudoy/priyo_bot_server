import { getGeminiClient, isGeminiConfigured } from '../../config/gemini.js';
import { ENV } from '../../config/env.js';
import { VectorSearchResult } from '../../types/index.js';

export class RetrievalReranker {
  public static async rerank(question: string, candidates: VectorSearchResult[], limit = 6): Promise<VectorSearchResult[]> {
    if (!isGeminiConfigured() || candidates.length < 2) return candidates.slice(0, limit);
    try {
      const model = getGeminiClient().getGenerativeModel({ model: ENV.GEMINI_TEXT_MODEL, generationConfig: { temperature: 0, responseMimeType: 'application/json' } });
      const prompt = `Score each passage for its ability to answer the customer question. Semantic paraphrases and Bangla/English/Banglish equivalents count as relevant. Return JSON only: {"scores":[{"index":0,"score":0.0}]}. Do not answer.\nQuestion: ${question}\n${candidates.map((c, i) => `[${i}] ${c.content.slice(0, 1200)}`).join('\n')}`;
      const parsed = JSON.parse((await model.generateContent(prompt)).response.text());
      const scores = new Map<number, number>((Array.isArray(parsed.scores) ? parsed.scores : []).map((x: any) => [Number(x.index), Number(x.score)]));
      return candidates.map((c, i) => ({ ...c, rerankerScore: scores.get(i) ?? 0 }))
        .filter((c) => (c.rerankerScore ?? 0) >= 0.15 || c.retrievalChannels?.includes('graph'))
        .sort((a, b) => (b.rerankerScore ?? 0) - (a.rerankerScore ?? 0)).slice(0, limit);
    } catch (error) {
      console.warn('Retrieval reranking failed; retaining fused ranking.', error);
      return candidates.slice(0, limit);
    }
  }
}
