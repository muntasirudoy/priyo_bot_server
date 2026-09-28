"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGeminiClient = getGeminiClient;
exports.isGeminiConfigured = isGeminiConfigured;
const generative_ai_1 = require("@google/generative-ai");
const env_js_1 = require("./env.js");
let genAI = null;
function getGeminiClient() {
    if (!genAI) {
        if (!env_js_1.ENV.GEMINI_API_KEY) {
            console.warn('⚠️ WARNING: GEMINI_API_KEY is not set. Gemini API calls will fail or fall back to mock mode.');
        }
        genAI = new generative_ai_1.GoogleGenerativeAI(env_js_1.ENV.GEMINI_API_KEY || 'dummy-key');
    }
    return genAI;
}
function isGeminiConfigured() {
    const key = env_js_1.ENV.GEMINI_API_KEY?.trim() || '';
    return Boolean(key.length > 5 &&
        !key.includes('your_gemini_api_key_here') &&
        !key.includes('dummy') &&
        !key.startsWith('AIzaSy_fake'));
}
