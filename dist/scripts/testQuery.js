"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_js_1 = require("../config/database.js");
const EmbeddingService_js_1 = require("../services/embedding/EmbeddingService.js");
const VectorSearchService_js_1 = require("../services/vector-search/VectorSearchService.js");
const mongoose_1 = __importDefault(require("mongoose"));
async function main() {
    await (0, database_js_1.connectDatabase)();
    const testQueries = [
        'tell me about this book',
        'what is the name of the book',
        'what expressions are in chapter 1',
        'What is the capital of France?',
        'Recipe for chocolate cake'
    ];
    for (const q of testQueries) {
        const emb = await EmbeddingService_js_1.EmbeddingService.generateEmbedding(q);
        const chunks = await VectorSearchService_js_1.VectorSearchService.searchSimilarChunks(emb, { similarityThreshold: 0.1 });
        console.log(`Query: "${q}" -> Top Score: ${chunks[0]?.similarityScore}`);
    }
    await mongoose_1.default.disconnect();
    process.exit(0);
}
main().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
});
