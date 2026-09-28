import { cleanText } from '../utils/textCleaner.js';
import { cosineSimilarity } from '../utils/math.js';
import { ChunkingService } from '../services/documents/ChunkingService.js';
import { EmbeddingService } from '../services/embedding/EmbeddingService.js';
import { RagService } from '../services/ai/RagService.js';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

async function runAllTests() {
  console.log('\n🧪 Running AI Customer Support Chatbot System Test Suite...\n');

  // Test 1: Text Cleaner
  console.log('--- 1. Text Cleaner Tests ---');
  const dirtyText = 'Hello \r\n world!   This  is   a  test.\n\n\n\nNew paragraph with re-\nfund.';
  const cleaned = cleanText(dirtyText);
  assert(!cleaned.includes('\r'), 'Removes carriage returns');
  assert(!cleaned.includes('   '), 'Collapses consecutive horizontal spaces');
  assert(!cleaned.includes('\n\n\n'), 'Collapses excessive newlines');
  assert(cleaned.includes('refund'), 'Heals broken hyphenated words');

  // Test 2: Math - Cosine Similarity
  console.log('\n--- 2. Cosine Similarity Tests ---');
  const vecA = [1, 0, 0];
  const vecB = [1, 0, 0];
  const vecC = [0, 1, 0];
  const vecD = [0.5, 0.5, 0];

  assert(Math.abs(cosineSimilarity(vecA, vecB) - 1.0) < 1e-6, 'Identical vectors have similarity 1.0');
  assert(Math.abs(cosineSimilarity(vecA, vecC) - 0.0) < 1e-6, 'Orthogonal vectors have similarity 0.0');
  assert(cosineSimilarity(vecA, vecD) > 0.5, 'Partially aligned vectors have positive similarity');
  assert(cosineSimilarity([], [1, 2]) === 0, 'Handles empty vectors safely');

  // Test 3: Chunking Service
  console.log('\n--- 3. Chunking Service Tests ---');
  const samplePages = [
    {
      pageNumber: 1,
      text: 'Shipping Policy.\n\nOrders are processed within 1-2 business days. Delivery takes 3-5 business days for standard shipping and 1-2 days for express shipping.\n\nTracking numbers are sent via email as soon as the package ships.',
    },
    {
      pageNumber: 2,
      text: 'Refund and Return Policy.\n\nYou may request a refund within 30 days of receiving your item. Items must be in original condition with tags attached.\n\nTo initiate a return, contact support@company.com with your order number.',
    },
  ];

  const chunks = ChunkingService.chunkPages(samplePages, 200, 30);
  assert(chunks.length >= 2, `Generated expected chunks (got ${chunks.length})`);
  assert(chunks[0].pageNumber === 1, 'First chunk preserves page 1');
  assert(chunks[chunks.length - 1].pageNumber === 2, 'Last chunk preserves page 2');
  assert(chunks[0].chunkIndex === 0, 'Chunk indexing starts at 0');
  assert(chunks[1].chunkIndex === 1, 'Chunk indexing increments sequentially');
  assert(chunks.every((c) => c.content.length > 0), 'All chunks have non-empty content');

  // Test 4: Embedding Service
  console.log('\n--- 4. Embedding Service Tests ---');
  const embeddingA = await EmbeddingService.generateEmbedding('How long does shipping take?');
  const embeddingB = await EmbeddingService.generateEmbedding('What is the shipping duration?');
  const embeddingC = await EmbeddingService.generateEmbedding('Can I get a refund for my purchase?');
  const embeddingOffTopic = await EmbeddingService.generateEmbedding('What is the weather on Mars?');

  assert(Array.isArray(embeddingA) && embeddingA.length > 0, 'Embedding is a non-empty array');
  const simShipping = cosineSimilarity(embeddingA, embeddingB);
  const simRefund = cosineSimilarity(embeddingA, embeddingC);
  const simMars = cosineSimilarity(embeddingA, embeddingOffTopic);

  console.log(`     Similarity (Shipping Q vs Shipping Q rephrased): ${simShipping.toFixed(4)}`);
  console.log(`     Similarity (Shipping Q vs Refund Q): ${simRefund.toFixed(4)}`);
  console.log(`     Similarity (Shipping Q vs Mars Q): ${simMars.toFixed(4)}`);
  assert(simShipping > simMars, 'Rephrased question has higher similarity than off-topic question');

  // Test 5: Human Escalation Detection
  console.log('\n--- 5. Human Escalation Detection Tests ---');
  assert(RagService.isHumanEscalationRequested('I want to talk to a human'), 'Detects "talk to a human"');
  assert(RagService.isHumanEscalationRequested('Please connect me with an agent'), 'Detects "agent"');
  assert(!RagService.isHumanEscalationRequested('How long does shipping take?'), 'Does not trigger on standard question');

  // Test 6: RAG Structured Response with No Context (Fallback)
  console.log('\n--- 6. RAG Grounding & No Context Fallback ---');
  const emptyContextResponse = await RagService.generateAnswer('What is your Mars policy?', []);
  assert(emptyContextResponse.confidence === 'low', 'Confidence is low when no context is found');
  assert(!emptyContextResponse.needsHuman, 'needsHuman is false by default');
  assert(emptyContextResponse.answer.includes('couldn\'t find this information'), 'Returns standard grounded no-info message');

  // Test 7: JWT Auth
  console.log('\n--- 7. JWT Auth Tests ---');
  const payload = { adminId: '654321654321654321654321', email: 'admin@support.com' };
  const token = jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: '1h' });
  const decoded = jwt.verify(token, ENV.JWT_SECRET) as any;
  assert(decoded.email === 'admin@support.com', 'JWT encodes and decodes admin email correctly');

  // Summary
  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
