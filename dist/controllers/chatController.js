"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const ConversationService_js_1 = require("../services/conversations/ConversationService.js");
const EmbeddingService_js_1 = require("../services/embedding/EmbeddingService.js");
const VectorSearchService_js_1 = require("../services/vector-search/VectorSearchService.js");
const RagService_js_1 = require("../services/ai/RagService.js");
const QueryUnderstandingService_js_1 = require("../services/ai/QueryUnderstandingService.js");
const RetrievalReranker_js_1 = require("../services/ai/RetrievalReranker.js");
const Conversation_js_1 = require("../models/Conversation.js");
const BotSettings_js_1 = require("../models/BotSettings.js");
class ChatController {
    static async getGreeting(_req, res, next) {
        try {
            const settings = await (0, BotSettings_js_1.getBotSettings)();
            res.json({ success: true, data: { botName: settings.botName, greetingMessage: settings.greetingMessage } });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Main chat message handler for customer questions.
     */
    static async sendMessage(req, res, next) {
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
                res.status(400).json({ success: false, message: 'A valid userEmail is required.', code: 'INVALID_EMAIL' });
                return;
            }
            // 1. Find or create conversation
            const conversation = await ConversationService_js_1.ConversationService.getOrCreateConversation(sessionId, siteId.trim() || 'default', userEmail.toLowerCase(), userName);
            // 2. Save USER message
            await ConversationService_js_1.ConversationService.addMessage(conversation._id, 'USER', trimmedMessage);
            if (conversation.status === 'agent_active') {
                res.json({ success: true, answer: '', sources: [], conversationId: conversation._id.toString(), needsHuman: true, status: conversation.status });
                return;
            }
            const intent = QueryUnderstandingService_js_1.QueryUnderstandingService.classifyIntent(trimmedMessage);
            if (intent === 'HUMAN_NEEDED' || intent === 'CHITCHAT') {
                const response = await RagService_js_1.RagService.generateAnswer(trimmedMessage, [], [], intent);
                if (response.needsHuman)
                    await ConversationService_js_1.ConversationService.updateStatus(conversation._id, 'human_requested');
                await ConversationService_js_1.ConversationService.addMessage(conversation._id, 'ASSISTANT', response.answer);
                res.json({ success: true, answer: response.answer, sources: [], conversationId: conversation._id.toString(), needsHuman: response.needsHuman, status: response.needsHuman ? 'human_requested' : conversation.status });
                return;
            }
            const priorHistory = await ConversationService_js_1.ConversationService.getMessages(conversation._id, 10);
            const priorContext = priorHistory.filter((m) => m.role === 'USER' || m.role === 'ASSISTANT' || m.role === 'AGENT').map((m) => ({ role: m.role, content: m.content }));
            const expandedQuery = await QueryUnderstandingService_js_1.QueryUnderstandingService.expand(trimmedMessage, priorContext.slice(0, -1));
            // 3. Generate a semantic embedding for the standalone multilingual query
            console.log(`🔍 Generating query embedding for: "${trimmedMessage.slice(0, 50)}..."`);
            const queryEmbedding = await EmbeddingService_js_1.EmbeddingService.generateEmbedding(expandedQuery.standalone);
            // 4. Search relevant chunks via VectorSearchService
            const fusedChunks = await VectorSearchService_js_1.VectorSearchService.searchHybrid(queryEmbedding, expandedQuery, { topK: 12 });
            const retrievedChunks = await RetrievalReranker_js_1.RetrievalReranker.rerank(expandedQuery.standalone, fusedChunks);
            console.log(`🎯 Found ${retrievedChunks.length} relevant chunk(s) above threshold.`);
            // 5. Get recent conversation history
            const history = priorHistory;
            const recentContextHistory = history
                .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT' || m.role === 'AGENT')
                .map((m) => ({ role: m.role, content: m.content }));
            // 6. & 7. Call Gemini text model & validate structured response
            const aiResponse = await RagService_js_1.RagService.generateAnswer(trimmedMessage, retrievedChunks, recentContextHistory, intent, { userEmail: conversation.userEmail, conversationId: conversation._id });
            // Handle human escalation
            if (aiResponse.needsHuman) {
                console.log(`🚨 Escalating conversation ${conversation._id} to HUMAN_REQUIRED`);
                await ConversationService_js_1.ConversationService.updateStatus(conversation._id, 'human_requested');
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
            await ConversationService_js_1.ConversationService.addMessage(conversation._id, 'ASSISTANT', aiResponse.answer, sources);
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
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Retrieves conversation history for the customer's current session.
     */
    static async getCustomerConversation(req, res, next) {
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
            const conversation = await Conversation_js_1.Conversation.findOne({ sessionId });
            if (!conversation || conversation.userEmail !== String(req.query.userEmail || '').toLowerCase()) {
                res.status(404).json({ success: false, message: 'Conversation unavailable.', code: 'CONVERSATION_NOT_FOUND' });
                return;
            }
            const messages = await ConversationService_js_1.ConversationService.getMessages(conversation._id);
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
        }
        catch (err) {
            next(err);
        }
    }
}
exports.ChatController = ChatController;
