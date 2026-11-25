import { Request, Response, NextFunction } from 'express';
import { ConversationService } from '../services/conversations/ConversationService.js';
import { EmbeddingService } from '../services/embedding/EmbeddingService.js';
import { VectorSearchService } from '../services/vector-search/VectorSearchService.js';
import { RagService } from '../services/ai/RagService.js';
import { QueryUnderstandingService } from '../services/ai/QueryUnderstandingService.js';
import { RetrievalReranker } from '../services/ai/RetrievalReranker.js';
import { Conversation } from '../models/Conversation.js';
import { getBotSettings } from '../models/BotSettings.js';

export class ChatController {
  public static async getGreeting(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try { const settings = await getBotSettings(); res.json({ success: true, data: { botName: settings.botName, greetingMessage: settings.greetingMessage } }); } catch (err) { next(err); }
  }
  /**
   * Main chat message handler for customer questions.
   */
  public static async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId, message, siteId = 'default', userEmail, userName } = req.body;

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
      if (typeof userEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(userEmail) || (userName !== undefined && (typeof userName !== 'string' || userName.length > 120))) {
        res.status(400).json({ success: false, message: 'A valid userEmail is required.', code: 'INVALID_EMAIL' }); return;
      }

      // 1. Find or create conversation
      const conversation = await ConversationService.getOrCreateConversation(sessionId, siteId.trim() || 'default', userEmail.toLowerCase(), userName);

      // 2. Save USER message
      await ConversationService.addMessage(conversation._id, 'USER', trimmedMessage);
      if (conversation.status === 'agent_active') {
        res.json({ success: true, answer: '', sources: [], conversationId: conversation._id.toString(), needsHuman: true, status: conversation.status }); return;
      }
      const intent = QueryUnderstandingService.classifyIntent(trimmedMessage);
      if (intent === 'HUMAN_NEEDED' || intent === 'CHITCHAT') {
        const response = await RagService.generateAnswer(trimmedMessage, [], [], intent);
        if (response.needsHuman) await ConversationService.updateStatus(conversation._id, 'human_requested');
        await ConversationService.addMessage(conversation._id, 'ASSISTANT', response.answer);
        res.json({ success: true, answer: response.answer, sources: [], conversationId: conversation._id.toString(), needsHuman: response.needsHuman, status: response.needsHuman ? 'human_requested' : conversation.status }); return;
      }

      const priorHistory = await ConversationService.getMessages(conversation._id, 20);
      const priorContext = priorHistory.filter((m) => m.role === 'USER' || m.role === 'ASSISTANT' || m.role === 'AGENT').map((m) => ({ role: m.role, content: m.content }));
      const expandedQuery = await QueryUnderstandingService.expand(trimmedMessage, priorContext.slice(0, -1));
      if (expandedQuery.followUpType === 'ambiguous' && expandedQuery.contextTopic) {
        const answer = `${expandedQuery.contextTopic} somporke konta jante chan—tar kaj, experience, naki current company?`;
        await ConversationService.addMessage(conversation._id, 'ASSISTANT', answer);
        res.json({ success: true, answer, sources: [], conversationId: conversation._id.toString(), needsHuman: false, status: conversation.status }); return;
      }
      const previousMessages = priorHistory.slice(0, -1);
      const topic = expandedQuery.contextTopic?.toLowerCase();
      const anchorDocumentId = topic ? QueryUnderstandingService.contextDocumentId(topic, previousMessages) : undefined;

      // 3. Generate a semantic embedding for the standalone multilingual query
      console.log(`🔍 Generating query embedding for: "${trimmedMessage.slice(0, 50)}..."`);
      const queryEmbedding = await EmbeddingService.generateEmbedding(expandedQuery.standalone);

      // 4. Search relevant chunks via VectorSearchService
      const fusedChunks = await VectorSearchService.searchHybrid(queryEmbedding, expandedQuery, { topK: 12, documentId: anchorDocumentId });
      const scopedChunks = topic && !anchorDocumentId ? fusedChunks.filter((chunk) => `${chunk.documentName} ${chunk.content}`.toLowerCase().includes(topic)) : fusedChunks;
      const retrievedChunks = await RetrievalReranker.rerank(expandedQuery.standalone, scopedChunks);
      console.log(`🎯 Found ${retrievedChunks.length} relevant chunk(s) above threshold.`);

      // 5. Get recent conversation history
      const history = priorHistory;
      const recentContextHistory = history
        .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT' || m.role === 'AGENT')
        .map((m) => ({ role: m.role, content: m.content }));

      // 6. & 7. Call Gemini text model & validate structured response
      const aiResponse = await RagService.generateAnswer(
        trimmedMessage,
        retrievedChunks,
        recentContextHistory, intent, { userEmail: conversation.userEmail, conversationId: conversation._id }, undefined, expandedQuery.standalone, expandedQuery.followUpType, Boolean(anchorDocumentId)
      );

      // Handle human escalation
      if (aiResponse.needsHuman) {
        console.log(`🚨 Escalating conversation ${conversation._id} to HUMAN_REQUIRED`);
        await ConversationService.updateStatus(conversation._id, 'human_requested');
      }

      // Format sources for storage and response
      const sources = (aiResponse.confidence === 'low' ? [] : retrievedChunks).map((chunk) => ({
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
        status: aiResponse.needsHuman ? 'human_requested' : conversation.status,
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

      const conversation = await Conversation.findOne({ sessionId });
      if (!conversation || conversation.userEmail !== String(req.query.userEmail || '').toLowerCase()) {
        res.status(404).json({ success: false, message: 'Conversation unavailable.', code: 'CONVERSATION_NOT_FOUND' }); return;
      }
      const messages = await ConversationService.getMessages(conversation._id);

      res.json({
        success: true,
        data: {
          conversation: {
            id: conversation._id.toString(),
            sessionId: conversation.sessionId,
            siteId: conversation.siteId,
            userEmail: conversation.userEmail,
            userName: conversation.userName,
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
