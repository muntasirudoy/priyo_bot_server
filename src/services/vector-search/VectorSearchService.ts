import { DocumentChunk } from '../../models/DocumentChunk.js';
import { DocumentModel } from '../../models/Document.js';
import { cosineSimilarity } from '../../utils/math.js';
import { ExpandedQuery, SearchOptions, VectorSearchResult } from '../../types/index.js';
import { RAG_CONFIG } from '../../constants/index.js';
import { ENV } from '../../config/env.js';
import { GraphRagService } from '../graph/GraphRagService.js';

export class VectorSearchService {
  private static tokens(text: string): Set<string> { return new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []); }

  public static async searchSimilarChunks(queryEmbedding: number[], options?: SearchOptions): Promise<VectorSearchResult[]> {
    return this.searchHybrid(queryEmbedding, { original: '', standalone: '', variants: [], keywords: [], entities: [] }, options);
  }

  public static async searchHybrid(queryEmbedding: number[], query: ExpandedQuery, options?: SearchOptions): Promise<VectorSearchResult[]> {
    const topK = options?.topK ?? RAG_CONFIG.MAX_RETRIEVED_CHUNKS;
    const docs = await DocumentModel.find({ status: 'COMPLETED' }, '_id originalName').lean();
    const names = new Map(docs.map((d) => [String(d._id), d.originalName]));
    const filter: Record<string, unknown> = { documentId: { $in: docs.map((d) => d._id) } }; if (options?.documentId) filter.documentId = options.documentId;
    const chunks = await DocumentChunk.find(filter).lean(); const graphPaths = await GraphRagService.retrieve(query, RAG_CONFIG.MAX_GRAPH_HOPS);
    const current = chunks.filter((c) => c.embeddingDimension === queryEmbedding.length && c.embeddingVersion === ENV.EMBEDDING_VERSION);
    const dense = current.map((c) => ({ c, score: cosineSimilarity(queryEmbedding, c.embedding) }))
      .filter((x) => x.score >= (options?.similarityThreshold ?? RAG_CONFIG.DEFAULT_SIMILARITY_THRESHOLD))
      .sort((a, b) => b.score - a.score).slice(0, RAG_CONFIG.DENSE_CANDIDATES);
    const queryTokens = new Set([...this.tokens(query.standalone || query.original), ...query.keywords.map((x) => x.toLowerCase())]);
    const lexical = chunks.map((c) => { const words = this.tokens(`${c.sectionTitle || ''} ${c.content} ${(c.keywords || []).join(' ')}`); let matches = 0; for (const token of queryTokens) if (words.has(token)) matches++; return { c, score: queryTokens.size ? matches / queryTokens.size : 0 }; })
      .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, RAG_CONFIG.LEXICAL_CANDIDATES);
    const fused = new Map<string, { chunk: typeof chunks[number]; score: number; dense: number; channels: Set<string>; path?: string[] }>();
    const add = (chunk: typeof chunks[number], rank: number, channel: string, denseScore = 0, path?: string[]) => { const id = String(chunk._id); const item = fused.get(id) || { chunk, score: 0, dense: denseScore, channels: new Set<string>() }; item.score += 1 / (RAG_CONFIG.RRF_K + rank + 1); item.dense = Math.max(item.dense, denseScore); item.channels.add(channel); if (path) item.path = path; fused.set(id, item); };
    dense.forEach((x, i) => add(x.c, i, 'dense', x.score)); lexical.forEach((x, i) => add(x.c, i, 'lexical'));
    chunks.filter((c) => graphPaths.has(String(c._id))).forEach((c, i) => add(c, i, 'graph', 0, graphPaths.get(String(c._id))));
    return [...fused.values()].sort((a, b) => b.score - a.score).slice(0, topK).map((x) => ({
      chunkId: String(x.chunk._id), documentId: String(x.chunk.documentId), documentName: names.get(String(x.chunk.documentId)) || 'Unknown Document', content: x.chunk.content,
      pageNumber: x.chunk.pageNumber, chunkIndex: x.chunk.chunkIndex, similarityScore: Math.round(x.dense * 1000) / 1000,
      fusedScore: x.score, retrievalChannels: [...x.channels], graphPath: x.path,
    }));
  }
}
