"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorSearchService = void 0;
const DocumentChunk_js_1 = require("../../models/DocumentChunk.js");
const Document_js_1 = require("../../models/Document.js");
const math_js_1 = require("../../utils/math.js");
const index_js_1 = require("../../constants/index.js");
const env_js_1 = require("../../config/env.js");
const GraphRagService_js_1 = require("../graph/GraphRagService.js");
class VectorSearchService {
    static tokens(text) { return new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []); }
    static async searchSimilarChunks(queryEmbedding, options) {
        return this.searchHybrid(queryEmbedding, { original: '', standalone: '', variants: [], keywords: [], entities: [] }, options);
    }
    static async searchHybrid(queryEmbedding, query, options) {
        const topK = options?.topK ?? index_js_1.RAG_CONFIG.MAX_RETRIEVED_CHUNKS;
        const docs = await Document_js_1.DocumentModel.find({ status: 'COMPLETED' }, '_id originalName').lean();
        const names = new Map(docs.map((d) => [String(d._id), d.originalName]));
        const filter = { documentId: { $in: docs.map((d) => d._id) } };
        if (options?.documentId)
            filter.documentId = options.documentId;
        const chunks = await DocumentChunk_js_1.DocumentChunk.find(filter).lean();
        const graphPaths = await GraphRagService_js_1.GraphRagService.retrieve(query, index_js_1.RAG_CONFIG.MAX_GRAPH_HOPS);
        const current = chunks.filter((c) => c.embeddingDimension === queryEmbedding.length && c.embeddingVersion === env_js_1.ENV.EMBEDDING_VERSION);
        const dense = current.map((c) => ({ c, score: (0, math_js_1.cosineSimilarity)(queryEmbedding, c.embedding) }))
            .filter((x) => x.score >= (options?.similarityThreshold ?? index_js_1.RAG_CONFIG.DEFAULT_SIMILARITY_THRESHOLD))
            .sort((a, b) => b.score - a.score).slice(0, index_js_1.RAG_CONFIG.DENSE_CANDIDATES);
        const queryTokens = new Set([...this.tokens(query.standalone || query.original), ...query.keywords.map((x) => x.toLowerCase())]);
        const lexical = chunks.map((c) => { const words = this.tokens(`${c.sectionTitle || ''} ${c.content} ${(c.keywords || []).join(' ')}`); let matches = 0; for (const token of queryTokens)
            if (words.has(token))
                matches++; return { c, score: queryTokens.size ? matches / queryTokens.size : 0 }; })
            .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, index_js_1.RAG_CONFIG.LEXICAL_CANDIDATES);
        const fused = new Map();
        const add = (chunk, rank, channel, denseScore = 0, path) => { const id = String(chunk._id); const item = fused.get(id) || { chunk, score: 0, dense: denseScore, channels: new Set() }; item.score += 1 / (index_js_1.RAG_CONFIG.RRF_K + rank + 1); item.dense = Math.max(item.dense, denseScore); item.channels.add(channel); if (path)
            item.path = path; fused.set(id, item); };
        dense.forEach((x, i) => add(x.c, i, 'dense', x.score));
        lexical.forEach((x, i) => add(x.c, i, 'lexical'));
        chunks.filter((c) => graphPaths.has(String(c._id))).forEach((c, i) => add(c, i, 'graph', 0, graphPaths.get(String(c._id))));
        return [...fused.values()].sort((a, b) => b.score - a.score).slice(0, topK).map((x) => ({
            chunkId: String(x.chunk._id), documentId: String(x.chunk.documentId), documentName: names.get(String(x.chunk.documentId)) || 'Unknown Document', content: x.chunk.content,
            pageNumber: x.chunk.pageNumber, chunkIndex: x.chunk.chunkIndex, similarityScore: Math.round(x.dense * 1000) / 1000,
            fusedScore: x.score, retrievalChannels: [...x.channels], graphPath: x.path,
        }));
    }
}
exports.VectorSearchService = VectorSearchService;
