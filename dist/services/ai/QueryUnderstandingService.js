"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryUnderstandingService = void 0;
const gemini_js_1 = require("../../config/gemini.js");
const env_js_1 = require("../../config/env.js");
const index_js_1 = require("../../constants/index.js");
class QueryUnderstandingService {
    static contextDocumentId(topic, messages) {
        for (let index = messages.length - 1; index >= 0; index--) {
            if (messages[index].role !== 'USER' || !messages[index].content.toLowerCase().includes(topic.toLowerCase()))
                continue;
            for (let next = index + 1; next < messages.length && messages[next].role !== 'USER'; next++) {
                const sources = messages[next].sources || [];
                const matching = sources.find((source) => source.documentName?.toLowerCase().includes(topic.toLowerCase()));
                if (matching)
                    return matching.documentId;
                if (sources.length === 1)
                    return sources[0].documentId;
            }
        }
        return undefined;
    }
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
    static localExpand(question, history = []) {
        const prior = [...history].reverse().filter((item) => item.role === 'USER').map((item) => item.content.match(/\b([\p{L}]{3,})\s+(?:k|ke|who|কে)\??/iu)?.[1]
            || item.content.match(/\bwho\s+is\s+([\p{L}]{3,})/iu)?.[1]
            || item.content.match(/\b(?:about|regarding)\s+([\p{L}]{3,})/iu)?.[1]).find(Boolean);
        const hasTopic = Boolean(prior && !question.toLowerCase().includes(prior.toLowerCase()));
        let followUpType;
        if (hasTopic) {
            if (/\b(company|employer|workplace|kon company)\b|কোম্পানি/i.test(question))
                followUpType = 'company';
            else if (/\b(ki kore|kaj kore|kaj korche|occupation|profession|role|what does|job)\b|কী করে|কি করে|পেশা/i.test(question))
                followUpType = 'role';
            else if (/\b(details|detail|aro|more|bistar|experience)\b|বিস্তারিত|আরও/i.test(question))
                followUpType = 'details';
            else if (/^\s*(r|ar|আর)\s*\?\s*$/i.test(question))
                followUpType = 'ambiguous';
            else if (this.tokens(question).length <= 12 && /\b(kon|ki|kothay|kobe|kar|tar|se|uni|who|what|where|when|which|does|his|her|their|he|she)\b|কোন|কোথায়|তার|তিনি/i.test(question))
                followUpType = 'other';
        }
        const standalone = followUpType === 'company' ? `${prior} current company employer`
            : followUpType === 'role' ? `${prior} occupation profession job role`
                : followUpType === 'details' ? `${prior} biography work experience details`
                    : followUpType === 'other' ? `${prior} ${question}` : question;
        const variants = followUpType === 'company' ? [question, standalone, `${prior} employer`]
            : followUpType === 'role' ? [question, standalone, `${prior} profession`]
                : followUpType === 'details' ? [question, standalone, `${prior} experience`]
                    : standalone !== question ? [question, standalone] : [question];
        const terms = new Set(this.tokens(standalone));
        for (const group of index_js_1.MULTILINGUAL_TERM_GROUPS) {
            if (group.some((term) => question.toLowerCase().includes(term)))
                group.forEach((term) => terms.add(term));
        }
        return { original: question, standalone, variants, keywords: [...terms], entities: prior && followUpType ? [prior] : [], contextTopic: prior && followUpType ? prior : undefined, followUpType };
    }
    static async expand(question, history = []) {
        const local = this.localExpand(question, history);
        if (local.followUpType)
            return local;
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
                standalone: typeof parsed.standalone === 'string' && parsed.standalone.trim() ? parsed.standalone : local.standalone,
                variants: [...new Set([...local.variants, ...(Array.isArray(parsed.variants) ? parsed.variants : [])])].slice(0, 5),
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
