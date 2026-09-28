"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const ConversationService_js_1 = require("../services/conversations/ConversationService.js");
const EmbeddingService_js_1 = require("../services/embedding/EmbeddingService.js");
const VectorSearchService_js_1 = require("../services/vector-search/VectorSearchService.js");
const RagService_js_1 = require("../services/ai/RagService.js");
class ChatController {
    /**
     * Main chat message handler for customer questions.
     */
    static async sendMessage(req, res, next) {
        try {
            const { sessionId, message } = req.body;
            if (!sessionId || !message || typeof message !== 'string' || message.trim().length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'sessionId and a non-empty message are required.',
                    code: 'INVALID_INPUT',
                });
                return;
            }
            const trimmedMessage = message.trim();
            // 1. Find or create conversation
            const conversation = await ConversationService_js_1.ConversationService.getOrCreateConversation(sessionId);
            // 2. Save USER message
            await ConversationService_js_1.ConversationService.addMessage(conversation._id, 'USER', trimmedMessage);
            // 3. Generate question embedding
            console.log(`🔍 Generating query embedding for: "${trimmedMessage.slice(0, 50)}..."`);
            const queryEmbedding = await EmbeddingService_js_1.EmbeddingService.generateEmbedding(trimmedMessage);
            // 4. Search relevant chunks via VectorSearchService
            const retrievedChunks = await VectorSearchService_js_1.VectorSearchService.searchSimilarChunks(queryEmbedding);
            console.log(`🎯 Found ${retrievedChunks.length} relevant chunk(s) above threshold.`);
            // 5. Get recent conversation history
            const history = await ConversationService_js_1.ConversationService.getMessages(conversation._id, 10);
            const recentContextHistory = history
                .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT')
                .map((m) => ({ role: m.role, content: m.content }));
            // 6. & 7. Call Gemini text model & validate structured response
            const aiResponse = await RagService_js_1.RagService.generateAnswer(trimmedMessage, retrievedChunks, recentContextHistory);
            // Handle human escalation
            if (aiResponse.needsHuman && conversation.status !== 'HUMAN_REQUIRED') {
                console.log(`🚨 Escalating conversation ${conversation._id} to HUMAN_REQUIRED`);
                await ConversationService_js_1.ConversationService.updateStatus(conversation._id, 'HUMAN_REQUIRED');
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
            const conversation = await ConversationService_js_1.ConversationService.getOrCreateConversation(sessionId);
            const messages = await ConversationService_js_1.ConversationService.getMessages(conversation._id);
            res.json({
                success: true,
                data: {
                    conversation: {
                        id: conversation._id.toString(),
                        sessionId: conversation.sessionId,
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
