"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const Conversation_js_1 = require("../models/Conversation.js");
const Message_js_1 = require("../models/Message.js");
const Document_js_1 = require("../models/Document.js");
class AdminController {
    static async getDashboardStats(_req, res, next) {
        try {
            const [totalConversations, totalQuestions, totalAiResponses, humanEscalationCount, totalDocuments, recentConversations,] = await Promise.all([
                Conversation_js_1.Conversation.countDocuments(),
                Message_js_1.Message.countDocuments({ role: 'USER' }),
                Message_js_1.Message.countDocuments({ role: 'ASSISTANT' }),
                Conversation_js_1.Conversation.countDocuments({ status: 'HUMAN_REQUIRED' }),
                Document_js_1.DocumentModel.countDocuments(),
                Conversation_js_1.Conversation.find().sort({ updatedAt: -1 }).limit(5).lean(),
            ]);
            res.json({
                success: true,
                data: {
                    metrics: {
                        totalConversations,
                        totalQuestions,
                        totalAiResponses,
                        humanEscalationCount,
                        totalDocuments,
                    },
                    recentConversations: recentConversations.map((c) => ({
                        id: c._id.toString(),
                        sessionId: c.sessionId,
                        status: c.status,
                        updatedAt: c.updatedAt,
                        createdAt: c.createdAt,
                    })),
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.AdminController = AdminController;
