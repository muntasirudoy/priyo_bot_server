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
            if (!status || !['ACTIVE', 'HUMAN_REQUIRED', 'CLOSED'].includes(status)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid status. Must be ACTIVE, HUMAN_REQUIRED, or CLOSED.',
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
}
exports.ConversationController = ConversationController;
