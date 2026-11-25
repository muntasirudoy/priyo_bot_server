import mongoose from 'mongoose';
import { ENV } from '../config/env.js';
import { DocumentModel } from '../models/Document.js';
import { DocumentChunk } from '../models/DocumentChunk.js';
import { BotSettings } from '../models/BotSettings.js';
import { EmbeddingService } from '../services/embedding/EmbeddingService.js';
import { QueryUnderstandingService } from '../services/ai/QueryUnderstandingService.js';
import { VectorSearchService } from '../services/vector-search/VectorSearchService.js';

async function main() {
  await mongoose.connect(ENV.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  const documents = await DocumentModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const chunks = await DocumentChunk.aggregate([{ $group: { _id: { version: '$embeddingVersion', dimension: '$embeddingDimension' }, count: { $sum: 1 } } }]);
  const settings = await BotSettings.findOne({ key: 'default' }).select('confidenceThreshold').lean();
  const question = process.argv.slice(2).join(' ') || 'ei companyr nam ki?';
  const expanded = await QueryUnderstandingService.expand(question);
  const embedding = await EmbeddingService.generateEmbedding(expanded.standalone);
  const results = await VectorSearchService.searchHybrid(embedding, expanded, { topK: 5 });
  console.log(JSON.stringify({ documents, chunks, configuredEmbeddingVersion: ENV.EMBEDDING_VERSION, queryEmbeddingDimension: embedding.length, confidenceThreshold: settings?.confidenceThreshold ?? 0.65, standaloneQuery: expanded.standalone, candidates: results.map((r) => ({ documentName: r.documentName, similarityScore: r.similarityScore, channels: r.retrievalChannels })) }, null, 2));
  await mongoose.disconnect();
}
main().catch((error) => { console.error('Knowledge diagnosis failed:', error instanceof Error ? error.message : error); process.exitCode = 1; });
