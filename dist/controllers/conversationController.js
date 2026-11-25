"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationController = void 0;
const ConversationService_js_1 = require("../services/conversations/ConversationService.js");
class ConversationController {
    static async listConversations(req, res, next) {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 20;
            const result = await ConversationService_js_1.ConversationService.listConversationsForAdmin(page, limit);
            res.json({
                success: true,
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async getConversation(req, res, next) {
        try {
            const { id } = req.params;
            const details = await ConversationService_js_1.ConversationService.getConversationDetails(id);
            if (!details) {
                res.status(404).json({
                    success: false,
                    message: 'Conversation not found.',
                    code: 'CONVERSATION_NOT_FOUND',
                });
                return;
            }
            res.json({
                success: true,
                data: details,
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async updateStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            if (!status || !['bot', 'human_requested', 'agent_active', 'resolved'].includes(status)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid conversation status.',
                    code: 'INVALID_STATUS',
                });
                return;
            }
            const updated = await ConversationService_js_1.ConversationService.updateStatus(id, status);
            if (!updated) {
                res.status(404).json({
                    success: false,
                    message: 'Conversation not found.',
                    code: 'CONVERSATION_NOT_FOUND',
                });
                return;
            }
            res.json({
                success: true,
                data: {
                    conversation: {
                        id: updated._id.toString(),
                        sessionId: updated.sessionId,
                        status: updated.status,
                        updatedAt: updated.updatedAt,
                    },
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async sendReply(req, res, next) {
        try {
            const { id } = req.params;
            const { message } = req.body;
            if (typeof message !== 'string' || !message.trim() || message.length > 5000) {
                res.status(400).json({ success: false, message: 'A reply is required.' });
                return;
            }
            const conversation = await ConversationService_js_1.ConversationService.updateStatus(id, 'agent_active');
            if (!conversation) {
                res.status(404).json({ success: false, message: 'Conversation not found.' });
                return;
            }
            const saved = await ConversationService_js_1.ConversationService.addMessage(conversation._id, 'AGENT', message.trim());
            res.status(201).json({ success: true, data: { id: saved._id.toString(), status: conversation.status } });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.ConversationController = ConversationController;
