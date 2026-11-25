"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const env_js_1 = require("../config/env.js");
const Document_js_1 = require("../models/Document.js");
const DocumentChunk_js_1 = require("../models/DocumentChunk.js");
const BotSettings_js_1 = require("../models/BotSettings.js");
const EmbeddingService_js_1 = require("../services/embedding/EmbeddingService.js");
const QueryUnderstandingService_js_1 = require("../services/ai/QueryUnderstandingService.js");
const VectorSearchService_js_1 = require("../services/vector-search/VectorSearchService.js");
async function main() {
    await mongoose_1.default.connect(env_js_1.ENV.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    const documents = await Document_js_1.DocumentModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    const chunks = await DocumentChunk_js_1.DocumentChunk.aggregate([{ $group: { _id: { version: '$embeddingVersion', dimension: '$embeddingDimension' }, count: { $sum: 1 } } }]);
    const settings = await BotSettings_js_1.BotSettings.findOne({ key: 'default' }).select('confidenceThreshold').lean();
    const question = process.argv.slice(2).join(' ') || 'ei companyr nam ki?';
    const expanded = await QueryUnderstandingService_js_1.QueryUnderstandingService.expand(question);
    const embedding = await EmbeddingService_js_1.EmbeddingService.generateEmbedding(expanded.standalone);
    const results = await VectorSearchService_js_1.VectorSearchService.searchHybrid(embedding, expanded, { topK: 5 });
    console.log(JSON.stringify({ documents, chunks, configuredEmbeddingVersion: env_js_1.ENV.EMBEDDING_VERSION, queryEmbeddingDimension: embedding.length, confidenceThreshold: settings?.confidenceThreshold ?? 0.65, standaloneQuery: expanded.standalone, candidates: results.map((r) => ({ documentName: r.documentName, similarityScore: r.similarityScore, channels: r.retrievalChannels })) }, null, 2));
    await mongoose_1.default.disconnect();
}
main().catch((error) => { console.error('Knowledge diagnosis failed:', error instanceof Error ? error.message : error); process.exitCode = 1; });
