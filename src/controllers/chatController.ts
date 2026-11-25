import { Request, Response, NextFunction } from 'express';
import { ConversationService } from '../services/conversations/ConversationService.js';
import { EmbeddingService } from '../services/embedding/EmbeddingService.js';
import { VectorSearchService } from '../services/vector-search/VectorSearchService.js';
import { RagService } from '../services/ai/RagService.js';
import { QueryUnderstandingService } from '../services/ai/QueryUnderstandingService.js';
import { RetrievalReranker } from '../services/ai/RetrievalReranker.js';

export class ChatController {
  /**
   * Main chat message handler for customer questions.
   */
  public static async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId, message, siteId = 'default' } = req.body;

      if (!sessionId || !message || typeof message !== 'string' || message.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'sessionId and a non-empty message are required.',
          code: 'INVALID_INPUT',
        });
        return;
      }
      if (typeof sessionId !== 'string' || sessionId.length > 128 || typeof siteId !== 'string' || siteId.length > 100 || message.length > 5000) {
        res.status(400).json({ success: false, message: 'Invalid sessionId, siteId, or message length.', code: 'INVALID_INPUT' });
        return;
      }

      const trimmedMessage = message.trim();

      // 1. Find or create conversation
      const conversation = await ConversationService.getOrCreateConversation(sessionId, siteId.trim() || 'default');

      // 2. Save USER message
      await ConversationService.addMessage(conversation._id, 'USER', trimmedMessage);

      const priorHistory = await ConversationService.getMessages(conversation._id, 10);
      const priorContext = priorHistory.filter((m) => m.role === 'USER' || m.role === 'ASSISTANT').map((m) => ({ role: m.role, content: m.content }));
      const expandedQuery = await QueryUnderstandingService.expand(trimmedMessage, priorContext.slice(0, -1));

      // 3. Generate a semantic embedding for the standalone multilingual query
      console.log(`🔍 Generating query embedding for: "${trimmedMessage.slice(0, 50)}..."`);
      const queryEmbedding = await EmbeddingService.generateEmbedding(expandedQuery.standalone);

      // 4. Search relevant chunks via VectorSearchService
      const fusedChunks = await VectorSearchService.searchHybrid(queryEmbedding, expandedQuery, { topK: 12 });
      const retrievedChunks = await RetrievalReranker.rerank(expandedQuery.standalone, fusedChunks);
      console.log(`🎯 Found ${retrievedChunks.length} relevant chunk(s) above threshold.`);

      // 5. Get recent conversation history
      const history = priorHistory;
      const recentContextHistory = history
        .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT')
        .map((m) => ({ role: m.role, content: m.content }));

      // 6. & 7. Call Gemini text model & validate structured response
      const aiResponse = await RagService.generateAnswer(
        trimmedMessage,
        retrievedChunks,
        recentContextHistory
      );

      // Handle human escalation
      if (aiResponse.needsHuman && conversation.status !== 'HUMAN_REQUIRED') {
        console.log(`🚨 Escalating conversation ${conversation._id} to HUMAN_REQUIRED`);
        await ConversationService.updateStatus(conversation._id, 'HUMAN_REQUIRED');
      }

      // Format sources for storage and response
      const sources = retrievedChunks.map((chunk) => ({
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        pageNumber: chunk.pageNumber,
        chunkId: chunk.chunkId,
        similarityScore: chunk.similarityScore,
      }));

      // 8. Save ASSISTANT message
      await ConversationService.addMessage(
        conversation._id,
        'ASSISTANT',
        aiResponse.answer,
        sources
      );

      // 9. Return structured answer, customer-friendly sources, and conversationId
      const customerSources = sources.map((s) => ({
        documentName: s.documentName,
        pageNumber: s.pageNumber,
      }));

      res.json({
        success: true,
        answer: aiResponse.answer,
        sources: customerSources,
        conversationId: conversation._id.toString(),
        needsHuman: aiResponse.needsHuman,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves conversation history for the customer's current session.
   */
  public static async getCustomerConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          message: 'sessionId is required.',
          code: 'SESSION_REQUIRED',
        });
        return;
      }

      const conversation = await ConversationService.getOrCreateConversation(sessionId);
      const messages = await ConversationService.getMessages(conversation._id);

      res.json({
        success: true,
        data: {
          conversation: {
            id: conversation._id.toString(),
            sessionId: conversation.sessionId,
            siteId: conversation.siteId,
            status: conversation.status,
            createdAt: conversation.createdAt,
          },
          messages: messages.map((m) => ({
            id: m._id.toString(),
            role: m.role,
            content: m.content,
            sources: m.sources.map((s) => ({
              documentName: s.documentName,
              pageNumber: s.pageNumber,
            })),
            createdAt: m.createdAt,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
