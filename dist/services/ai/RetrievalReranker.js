"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetrievalReranker = void 0;
const gemini_js_1 = require("../../config/gemini.js");
const env_js_1 = require("../../config/env.js");
class RetrievalReranker {
    static async rerank(question, candidates, limit = 6) {
        if (!(0, gemini_js_1.isGeminiConfigured)() || candidates.length < 2)
            return candidates.slice(0, limit);
        try {
            const model = (0, gemini_js_1.getGeminiClient)().getGenerativeModel({ model: env_js_1.ENV.GEMINI_TEXT_MODEL, generationConfig: { temperature: 0, responseMimeType: 'application/json' } });
            const prompt = `Score each passage for its ability to answer the customer question. Semantic paraphrases and Bangla/English/Banglish equivalents count as relevant. Return JSON only: {"scores":[{"index":0,"score":0.0}]}. Do not answer.\nQuestion: ${question}\n${candidates.map((c, i) => `[${i}] ${c.content.slice(0, 1200)}`).join('\n')}`;
            const parsed = JSON.parse((await model.generateContent(prompt)).response.text());
            const scores = new Map((Array.isArray(parsed.scores) ? parsed.scores : []).map((x) => [Number(x.index), Number(x.score)]));
            const ranked = candidates.map((c, i) => ({ ...c, rerankerScore: scores.has(i) && Number.isFinite(scores.get(i)) ? Math.min(1, Math.max(0, scores.get(i))) : undefined }))
                .sort((a, b) => Math.max(b.rerankerScore ?? 0, b.similarityScore, b.lexicalScore ?? 0) - Math.max(a.rerankerScore ?? 0, a.similarityScore, a.lexicalScore ?? 0));
            return ranked.slice(0, limit);
        }
        catch (error) {
            console.warn('Retrieval reranking failed; retaining fused ranking.', error);
            return candidates.slice(0, limit);
        }
    }
}
exports.RetrievalReranker = RetrievalReranker;
