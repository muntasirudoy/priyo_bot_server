"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationService = void 0;
const Conversation_js_1 = require("../../models/Conversation.js");
const Message_js_1 = require("../../models/Message.js");
const mongoose_1 = require("mongoose");
class ConversationService {
    /**
     * Find existing conversation by sessionId or create a new one.
     */
    static async getOrCreateConversation(sessionId) {
        let conversation = await Conversation_js_1.Conversation.findOne({ sessionId });
        if (!conversation) {
            conversation = await Conversation_js_1.Conversation.create({
                sessionId,
                status: 'ACTIVE',
            });
        }
        return conversation;
    }
    /**
     * Add a message to a conversation.
     */
    static async addMessage(conversationId, role, content, sources = []) {
        const message = await Message_js_1.Message.create({
            conversationId: new mongoose_1.Types.ObjectId(conversationId),
            role,
            content,
            sources,
        });
        // Touch the conversation updatedAt
        await Conversation_js_1.Conversation.findByIdAndUpdate(conversationId, { updatedAt: new Date() });
        return message;
    }
    /**
     * Get recent messages for a conversation.
     */
    static async getMessages(conversationId, limit = 50) {
        return Message_js_1.Message.find({ conversationId: new mongoose_1.Types.ObjectId(conversationId) })
            .sort({ createdAt: 1 })
            .limit(limit);
    }
    /**
     * Update conversation status (e.g. to HUMAN_REQUIRED).
     */
    static async updateStatus(conversationId, status) {
        return Conversation_js_1.Conversation.findByIdAndUpdate(conversationId, { status }, { new: true });
    }
    /**
     * List all conversations with summary information for Admin view.
     */
    static async listConversationsForAdmin(page = 1, limit = 50) {
        const skip = (page - 1) * limit;
        const conversations = await Conversation_js_1.Conversation.find()
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        const total = await Conversation_js_1.Conversation.countDocuments();
        // Populate last question and message counts
        const populated = await Promise.all(conversations.map(async (conv) => {
            const lastUserMsg = await Message_js_1.Message.findOne({
                conversationId: conv._id,
                role: 'USER',
            })
                .sort({ createdAt: -1 })
                .select('content createdAt')
                .lean();
            const messageCount = await Message_js_1.Message.countDocuments({ conversationId: conv._id });
            return {
                id: conv._id.toString(),
                sessionId: conv.sessionId,
                status: conv.status,
                createdAt: conv.createdAt,
                updatedAt: conv.updatedAt,
                lastQuestion: lastUserMsg?.content || 'No questions yet',
                lastActivity: conv.updatedAt,
                messageCount,
            };
        }));
        return {
            conversations: populated,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }
    /**
     * Get full details of a specific conversation including all messages and sources.
     */
    static async getConversationDetails(conversationId) {
        const conversation = await Conversation_js_1.Conversation.findById(conversationId).lean();
        if (!conversation) {
            return null;
        }
        const messages = await Message_js_1.Message.find({ conversationId: conversation._id })
            .sort({ createdAt: 1 })
            .lean();
        return {
            conversation: {
                id: conversation._id.toString(),
                sessionId: conversation.sessionId,
                status: conversation.status,
                createdAt: conversation.createdAt,
                updatedAt: conversation.updatedAt,
            },
            messages: messages.map((m) => ({
                id: m._id.toString(),
                role: m.role,
                content: m.content,
                sources: m.sources || [],
                createdAt: m.createdAt,
            })),
        };
    }
}
exports.ConversationService = ConversationService;
