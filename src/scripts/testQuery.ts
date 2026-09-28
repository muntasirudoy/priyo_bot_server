import { connectDatabase } from '../config/database.js';
import { EmbeddingService } from '../services/embedding/EmbeddingService.js';
import { VectorSearchService } from '../services/vector-search/VectorSearchService.js';
import mongoose from 'mongoose';

async function main() {
  await connectDatabase();
  const testQueries = [
    'tell me about this book',
    'what is the name of the book',
    'what expressions are in chapter 1',
    'What is the capital of France?',
    'Recipe for chocolate cake'
  ];

  for (const q of testQueries) {
    const emb = await EmbeddingService.generateEmbedding(q);
    const chunks = await VectorSearchService.searchSimilarChunks(emb, { similarityThreshold: 0.1 });
    console.log(`Query: "${q}" -> Top Score: ${chunks[0]?.similarityScore}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
