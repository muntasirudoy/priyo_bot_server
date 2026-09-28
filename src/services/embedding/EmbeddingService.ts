import { getGeminiClient, isGeminiConfigured } from '../../config/gemini.js';
import { ENV } from '../../config/env.js';

export class EmbeddingService {
  private static get modelName() {
    return ENV.GEMINI_EMBEDDING_MODEL;
  }

  /**
   * Generates a vector embedding for a single text using Gemini Embedding model.
   */
  public static async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot generate embedding for empty text.');
    }

    if (!isGeminiConfigured()) {
      console.warn('⚠️ Gemini API key not configured. Using deterministic fallback embedding.');
      return this.generateDeterministicFallbackEmbedding(text);
    }

    try {
      const client = getGeminiClient();
      const model = client.getGenerativeModel({ model: this.modelName });
      const result = await model.embedContent(text);

      if (!result.embedding || !result.embedding.values) {
        throw new Error('Gemini API returned an empty embedding vector.');
      }

      return result.embedding.values;
    } catch (error: any) {
      console.warn('⚠️ Gemini embedding call failed, falling back to deterministic embedding:', error?.message || error);
      return this.generateDeterministicFallbackEmbedding(text);
    }
  }

  /**
   * Generates vector embeddings for an array of texts in batches.
   * Batches requests to respect API rate limits.
   */
  public static async generateEmbeddings(
    texts: string[],
    batchSize: number = 10
  ): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    if (!isGeminiConfigured()) {
      console.warn('⚠️ Gemini API key not configured. Using fallback embeddings for batch.');
      return texts.map((t) => this.generateDeterministicFallbackEmbedding(t));
    }

    const embeddings: number[][] = [];

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
  private static generateDeterministicFallbackEmbedding(text: string, dimensions = 768): number[] {
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
    if (norm === 0) return vector;
    return vector.map((val) => val / norm);
  }
}
