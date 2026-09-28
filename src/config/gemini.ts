import { GoogleGenerativeAI } from '@google/generative-ai';
import { ENV } from './env.js';

let genAI: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    if (!ENV.GEMINI_API_KEY) {
      console.warn('⚠️ WARNING: GEMINI_API_KEY is not set. Gemini API calls will fail or fall back to mock mode.');
    }
    genAI = new GoogleGenerativeAI(ENV.GEMINI_API_KEY || 'dummy-key');
  }
  return genAI;
}

export function isGeminiConfigured(): boolean {
  const key = ENV.GEMINI_API_KEY?.trim() || '';
  return Boolean(
    key.length > 5 &&
      !key.includes('your_gemini_api_key_here') &&
      !key.includes('dummy') &&
      !key.startsWith('AIzaSy_fake')
  );
}
