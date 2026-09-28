import { DocumentChunk } from '../../models/DocumentChunk.js';
import { DocumentModel } from '../../models/Document.js';
import { cosineSimilarity } from '../../utils/math.js';
import { SearchOptions, VectorSearchResult } from '../../types/index.js';
import { RAG_CONFIG } from '../../constants/index.js';
import { isGeminiConfigured } from '../../config/gemini.js';

export class VectorSearchService {
  /**
   * Search for chunks similar to the query embedding.
   * Compares the query vector against completed document chunks in MongoDB.
   */
  public static async searchSimilarChunks(
    queryEmbedding: number[],
    options?: SearchOptions
  ): Promise<VectorSearchResult[]> {
    const topK = options?.topK ?? RAG_CONFIG.MAX_RETRIEVED_CHUNKS;
    const defaultThreshold = isGeminiConfigured() ? RAG_CONFIG.DEFAULT_SIMILARITY_THRESHOLD : 0.08;
    const similarityThreshold = options?.similarityThreshold ?? defaultThreshold;

    // Filter to completed documents only
    const completedDocs = await DocumentModel.find({ status: 'COMPLETED' }, '_id originalName').lean();
    if (!completedDocs || completedDocs.length === 0) {
      return [];
    }

    const docNameMap = new Map<string, string>();
    const completedDocIds = completedDocs.map((doc) => {
      const idStr = doc._id.toString();
      docNameMap.set(idStr, doc.originalName);
      return doc._id;
    });

    const queryFilter: Record<string, unknown> = {
      documentId: { $in: completedDocIds },
    };

    if (options?.documentId) {
      queryFilter.documentId = options.documentId;
    }

    // Retrieve chunks with their embeddings
    const chunks = await DocumentChunk.find(queryFilter)
      .select('_id documentId content embedding pageNumber chunkIndex')
      .lean();

    if (!chunks || chunks.length === 0) {
      return [];
    }

    // Compute cosine similarity for each chunk
    const scoredChunks: VectorSearchResult[] = [];

    for (const chunk of chunks) {
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      if (score >= similarityThreshold) {
        const docIdStr = chunk.documentId.toString();
        scoredChunks.push({
          chunkId: chunk._id.toString(),
          documentId: docIdStr,
          documentName: docNameMap.get(docIdStr) || 'Unknown Document',
          content: chunk.content,
          pageNumber: chunk.pageNumber,
          chunkIndex: chunk.chunkIndex,
          similarityScore: Math.round(score * 1000) / 1000,
        });
      }
    }

    // Sort descending by similarity score
    scoredChunks.sort((a, b) => b.similarityScore - a.similarityScore);

    // Return topK results
    return scoredChunks.slice(0, topK);
  }
}
