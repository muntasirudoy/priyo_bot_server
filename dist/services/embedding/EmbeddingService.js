"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingService = void 0;
const gemini_js_1 = require("../../config/gemini.js");
const env_js_1 = require("../../config/env.js");
class EmbeddingService {
    static modelName = env_js_1.ENV.GEMINI_EMBEDDING_MODEL;
    /**
     * Generates a vector embedding for a single text using Gemini Embedding model.
     */
    static async generateEmbedding(text) {
        if (!text || text.trim().length === 0) {
            throw new Error('Cannot generate embedding for empty text.');
        }
        if (!(0, gemini_js_1.isGeminiConfigured)()) {
            console.warn('⚠️ Gemini API key not configured. Using deterministic fallback embedding.');
            return this.generateDeterministicFallbackEmbedding(text);
        }
        try {
            const client = (0, gemini_js_1.getGeminiClient)();
            const model = client.getGenerativeModel({ model: this.modelName });
            const result = await model.embedContent(text);
            if (!result.embedding || !result.embedding.values) {
                throw new Error('Gemini API returned an empty embedding vector.');
            }
            return result.embedding.values;
        }
        catch (error) {
            console.warn('⚠️ Gemini embedding call failed, falling back to deterministic embedding:', error?.message || error);
            return this.generateDeterministicFallbackEmbedding(text);
        }
    }
    /**
     * Generates vector embeddings for an array of texts in batches.
     * Batches requests to respect API rate limits.
     */
    static async generateEmbeddings(texts, batchSize = 10) {
        if (!texts || texts.length === 0) {
            return [];
        }
        if (!(0, gemini_js_1.isGeminiConfigured)()) {
            console.warn('⚠️ Gemini API key not configured. Using fallback embeddings for batch.');
            return texts.map((t) => this.generateDeterministicFallbackEmbedding(t));
        }
        const embeddings = [];
        // Process in batches
        for (let i = 0; i < texts.length; i += batchSize) {
            const chunk = texts.slice(i, i + batchSize);
            const batchPromises = chunk.map((text) => this.generateEmbedding(text));
            const batchResults = await Promise.all(batchPromises);
            embeddings.push(...batchResults);
            // Short pause between batches to avoid rate limits on free tier
            if (i + batchSize < texts.length) {
                await new Promise((resolve) => setTimeout(resolve, 300));
            }
        }
        return embeddings;
    }
    /**
     * Deterministic pseudo-embedding for testing or when API key is not yet configured.
     * Produces a 768-dimensional normalized vector based on character frequencies and hash.
     */
    static generateDeterministicFallbackEmbedding(text, dimensions = 768) {
        const vector = new Array(dimensions).fill(0);
        const cleaned = text.toLowerCase().trim();
        for (let i = 0; i < cleaned.length; i++) {
            const charCode = cleaned.charCodeAt(i);
            const idx = (charCode * 31 + i * 17) % dimensions;
            vector[idx] += 1;
        }
        // Add token hash distribution
        const words = cleaned.split(/\s+/);
        for (let w = 0; w < words.length; w++) {
            let hash = 0;
            for (let c = 0; c < words[w].length; c++) {
                hash = (hash << 5) - hash + words[w].charCodeAt(c);
                hash |= 0;
            }
            const wordIdx = Math.abs(hash) % dimensions;
            vector[wordIdx] += 2;
        }
        // Normalize
        const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        if (norm === 0)
            return vector;
        return vector.map((val) => val / norm);
    }
}
exports.EmbeddingService = EmbeddingService;
