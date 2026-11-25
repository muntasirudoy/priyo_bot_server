"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RagService = void 0;
const gemini_js_1 = require("../../config/gemini.js");
const env_js_1 = require("../../config/env.js");
const BotSettings_js_1 = require("../../models/BotSettings.js");
const UnansweredQuery_js_1 = require("../../models/UnansweredQuery.js");
const index_js_1 = require("../../constants/index.js");
class RagService {
    static isHumanEscalationRequested(message) { return index_js_1.HUMAN_ESCALATION_PHRASES.some((phrase) => message.toLowerCase().includes(phrase)); }
    static retrievalConfidence(chunks) {
        return Math.max(0, ...chunks.map((c) => Math.max(c.similarityScore, c.lexicalScore ?? 0, c.rerankerScore ?? 0)));
    }
    static groundedFallback(question, chunks, fallback, followUpType) {
        if (!chunks.length)
            return fallback;
        const ordered = [...chunks].sort((a, b) => Math.max(b.similarityScore, b.lexicalScore ?? 0, b.rerankerScore ?? 0) - Math.max(a.similarityScore, a.lexicalScore ?? 0, a.rerankerScore ?? 0));
        const faq = ordered.map((chunk) => /^Question:([^\n]*)\nAnswer:\s*([\s\S]+)/i.exec(chunk.content)).find((match) => {
            if (!match)
                return false;
            if (followUpType === 'company')
                return /company|employer|work(?:s|ing)?\s+(?:at|for)|কোম্পানি/i.test(match[1]);
            if (followUpType === 'role')
                return /role|profession|occupation|job|what does|who is|পেশা|কী করে/i.test(match[1]);
            return true;
        });
        if (faq)
            return faq[2].trim().slice(0, 600);
        const tokens = new Set((question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter((word) => !['what', 'the', 'this', 'that', 'with', 'your', 'companyr', 'nam', 'please'].includes(word)));
        const employment = /\b(company|employer|workplace|work|working|job|kaj|chakri)\b/i.test(question);
        const sentences = ordered.flatMap((chunk) => chunk.content.replace(/\s*\n\s*/g, ' ').split(/(?<=[.!?।])\s+/).map((sentence) => sentence.replace(/https?:\/\/\S+/g, '').trim()).filter((sentence) => sentence.length > 25 && sentence.length < 350 && /[\p{L}]/u.test(sentence)));
        const relevantSentences = sentences.filter((sentence) => {
            if (followUpType === 'company')
                return /\b(currently|present|works?\s+(?:at|for)|working\s+(?:at|for)|employed\s+(?:at|by)|employer|company)\b/i.test(sentence);
            if (followUpType === 'role')
                return /\b(manager|engineer|designer|developer|executive|founder|director|consultant|works?\s+as|role|position|profession)\b/i.test(sentence);
            return true;
        });
        const ranked = relevantSentences.map((sentence) => {
            const matches = [...tokens].filter((token) => sentence.toLowerCase().includes(token)).length;
            const employmentCue = employment && /\b(currently|present|works?\s+at|working\s+(?:at|for)|employed\s+(?:at|by)|company|employer)\b/i.test(sentence) ? 2 : 0;
            return { sentence, score: matches + employmentCue };
        }).sort((a, b) => b.score - a.score || b.sentence.length - a.sentence.length);
        if (ranked[0]?.score)
            return ranked[0].sentence;
        return fallback;
    }
    static clarify(question, fallback, searchQuestion) {
        if (searchQuestion && searchQuestion !== question && /current company employer workplace/i.test(searchQuestion)) {
            const subject = searchQuestion.split(' ')[0];
            return `${subject} currently kon company te kaj korchen, eta amar kache thaka information theke confirm korte parchi na.`;
        }
        if (searchQuestion && searchQuestion !== question && /occupation profession job role/i.test(searchQuestion)) {
            const subject = searchQuestion.split(' ')[0];
            return `${subject} er kaj niye nirdishto information ekhane confirm korte parchi na. Kon role ba company niye jante chan?`;
        }
        if (searchQuestion && searchQuestion !== question && /biography work experience details/i.test(searchQuestion)) {
            const subject = searchQuestion.split(' ')[0];
            return `${subject} somporke aro details dewar moto nirvorjoggo information ekhane nei.`;
        }
        if (/companyr?\s+nam|kon\s+company/i.test(question))
            return 'Kon companyr kotha bolchen? Nam ba ektu context dile check kore bolte parbo.';
        if (/company\s+name/i.test(question))
            return 'Which company do you mean? Tell me its name or share a little context and I’ll check.';
        if (/কোম্পানির নাম/i.test(question))
            return 'কোন কোম্পানির কথা বলছেন? নাম বা একটু প্রসঙ্গ দিলে দেখে বলতে পারব।';
        if (/[\u0980-\u09ff]/.test(question))
            return 'আরেকটু বিস্তারিত বলবেন? তাহলে আমি সঠিক তথ্যটা খুঁজে দেখতে পারব।';
        return fallback;
    }
    static async generateAnswer(userQuestion, chunks, history = [], intent = 'KNOWLEDGE_QUERY', identity, settings, searchQuestion, followUpType, contextAnchored = false) {
        const config = settings ?? await (0, BotSettings_js_1.getBotSettings)();
        if (intent === 'HUMAN_NEEDED')
            return { answer: 'I hear you. I’ve asked our support team to take over this chat and follow up at your email.', confidence: 'high', needsHuman: true };
        if (intent === 'CHITCHAT') {
            const bangla = /[\u0980-\u09ff]/.test(userQuestion);
            const thanks = /thank|ধন্যবাদ|dhonnobad/i.test(userQuestion);
            return { answer: bangla ? (thanks ? 'আপনাকে স্বাগতম! আর কিছুতে সাহায্য করতে পারি?' : 'হ্যালো! কীভাবে সাহায্য করতে পারি?') : (thanks ? 'You’re welcome! Anything else I can help with?' : 'Hi! What can I help you with?'), confidence: 'high', needsHuman: false };
        }
        const naturalFallback = this.clarify(userQuestion, config.fallbackMessage, searchQuestion);
        const groundedAnswer = this.groundedFallback(searchQuestion || userQuestion, chunks, naturalFallback, followUpType);
        const score = this.retrievalConfidence(chunks);
        if (score < config.confidenceThreshold && !(contextAnchored && groundedAnswer !== naturalFallback)) {
            if (identity)
                await UnansweredQuery_js_1.UnansweredQuery.create({ query: userQuestion, userEmail: identity.userEmail, conversationId: identity.conversationId });
            return { answer: naturalFallback, confidence: 'low', needsHuman: false };
        }
        if (!(0, gemini_js_1.isGeminiConfigured)())
            return { answer: groundedAnswer, confidence: groundedAnswer === naturalFallback ? 'low' : 'medium', needsHuman: false };
        try {
            const model = (0, gemini_js_1.getGeminiClient)().getGenerativeModel({ model: env_js_1.ENV.GEMINI_TEXT_MODEL, generationConfig: { temperature: 0.35, responseMimeType: 'application/json' } });
            const context = chunks.slice(0, 6).map((c) => c.content).join('\n\n');
            const prompt = `You are ${config.botName}, a ${config.tone} customer support person. Answer only from the supplied support knowledge. Never invent policies, prices, or promises. Write 2–4 concise conversational sentences in the customer's English, Bangla, or Banglish style. Avoid AI clichés such as "Certainly!", "Great question!", "Based on the provided document", and long lists. When evidence is incomplete, ask one natural clarifying question or offer a support team follow-up at their email. Return JSON: {"answer":"...","confidence":"high|medium|low","needsHuman":false}.
Knowledge:\n${context}\nRecent chat:\n${history.slice(-5).map((m) => `${m.role}: ${m.content}`).join('\n')}\nCustomer: ${userQuestion}`;
            const raw = (await model.generateContent(prompt)).response.text().replace(/^```json\s*|^```\s*|```$/g, '').trim();
            const parsed = JSON.parse(raw);
            if (typeof parsed === 'object' && parsed !== null && 'answer' in parsed && typeof parsed.answer === 'string' && parsed.answer.trim()) {
                const result = parsed;
                return { answer: result.answer.trim(), confidence: result.confidence === 'high' || result.confidence === 'low' ? result.confidence : 'medium', needsHuman: Boolean(result.needsHuman) };
            }
        }
        catch (error) {
            console.warn('Answer generation failed:', error);
        }
        return { answer: groundedAnswer, confidence: groundedAnswer === naturalFallback ? 'low' : 'medium', needsHuman: false };
    }
}
exports.RagService = RagService;
