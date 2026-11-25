"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryUnderstandingService = void 0;
const gemini_js_1 = require("../../config/gemini.js");
const env_js_1 = require("../../config/env.js");
const index_js_1 = require("../../constants/index.js");
class QueryUnderstandingService {
    static classifyIntent(message) {
        const text = message.toLowerCase().trim();
        if (/\b(human|agent|representative|real person|escalat|complain|frustrat|refund|supervisor)\b|মানুষ|এজেন্ট|রিফান্ড|ফেরত|manush|agent chai/i.test(text))
            return 'HUMAN_NEEDED';
        if (/^(hi|hello|hey|thanks|thank you|bye|good morning|good evening|how are you|assalamu alaikum|salam|ধন্যবাদ|হ্যালো|কেমন আছো)[!?.\s]*$/i.test(text))
            return 'CHITCHAT';
        return 'KNOWLEDGE_QUERY';
    }
    static tokens(text) {
        return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    }
    static localExpand(question) {
        const terms = new Set(this.tokens(question));
        for (const group of index_js_1.MULTILINGUAL_TERM_GROUPS) {
            if (group.some((term) => question.toLowerCase().includes(term)))
                group.forEach((term) => terms.add(term));
        }
        return { original: question, standalone: question, variants: [question], keywords: [...terms], entities: [] };
    }
    static async expand(question, history = []) {
        const local = this.localExpand(question);
        if (!(0, gemini_js_1.isGeminiConfigured)())
            return local;
        try {
            const model = (0, gemini_js_1.getGeminiClient)().getGenerativeModel({
                model: env_js_1.ENV.GEMINI_TEXT_MODEL,
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
                standalone: typeof parsed.standalone === 'string' ? parsed.standalone : question,
                variants: [...new Set([question, ...(Array.isArray(parsed.variants) ? parsed.variants : [])])].slice(0, 4),
                keywords: [...new Set([...local.keywords, ...(Array.isArray(parsed.keywords) ? parsed.keywords : [])])].slice(0, 30),
                entities: Array.isArray(parsed.entities) ? parsed.entities.filter((x) => typeof x === 'string').slice(0, 10) : [],
            };
        }
        catch (error) {
            console.warn('Query expansion failed; using local multilingual expansion.', error);
            return local;
        }
    }
}
exports.QueryUnderstandingService = QueryUnderstandingService;
