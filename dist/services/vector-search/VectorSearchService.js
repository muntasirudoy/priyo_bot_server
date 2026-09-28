"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorSearchService = void 0;
const DocumentChunk_js_1 = require("../../models/DocumentChunk.js");
const Document_js_1 = require("../../models/Document.js");
const math_js_1 = require("../../utils/math.js");
const index_js_1 = require("../../constants/index.js");
class VectorSearchService {
    /**
     * Search for chunks similar to the query embedding.
     * Compares the query vector against completed document chunks in MongoDB.
     */
    static async searchSimilarChunks(queryEmbedding, options) {
        const topK = options?.topK ?? index_js_1.RAG_CONFIG.MAX_RETRIEVED_CHUNKS;
        const similarityThreshold = options?.similarityThreshold ?? index_js_1.RAG_CONFIG.DEFAULT_SIMILARITY_THRESHOLD;
        // Filter to completed documents only
        const completedDocs = await Document_js_1.DocumentModel.find({ status: 'COMPLETED' }, '_id originalName').lean();
        if (!completedDocs || completedDocs.length === 0) {
            return [];
        }
        const docNameMap = new Map();
        const completedDocIds = completedDocs.map((doc) => {
            const idStr = doc._id.toString();
            docNameMap.set(idStr, doc.originalName);
            return doc._id;
        });
        const queryFilter = {
            documentId: { $in: completedDocIds },
        };
        if (options?.documentId) {
            queryFilter.documentId = options.documentId;
        }
        // Retrieve chunks with their embeddings
        const chunks = await DocumentChunk_js_1.DocumentChunk.find(queryFilter)
            .select('_id documentId content embedding pageNumber chunkIndex')
            .lean();
        if (!chunks || chunks.length === 0) {
            return [];
        }
        // Compute cosine similarity for each chunk
        const scoredChunks = [];
        for (const chunk of chunks) {
            const score = (0, math_js_1.cosineSimilarity)(queryEmbedding, chunk.embedding);
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
exports.VectorSearchService = VectorSearchService;
