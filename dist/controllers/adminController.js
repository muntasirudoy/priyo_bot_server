"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const Conversation_js_1 = require("../models/Conversation.js");
const Message_js_1 = require("../models/Message.js");
const Document_js_1 = require("../models/Document.js");
const BotSettings_js_1 = require("../models/BotSettings.js");
const UnansweredQuery_js_1 = require("../models/UnansweredQuery.js");
class AdminController {
    static async getDashboardStats(_req, res, next) {
        try {
            const [totalConversations, totalQuestions, totalAiResponses, humanEscalationCount, totalDocuments, recentConversations,] = await Promise.all([
                Conversation_js_1.Conversation.countDocuments(),
                Message_js_1.Message.countDocuments({ role: 'USER' }),
                Message_js_1.Message.countDocuments({ role: 'ASSISTANT' }),
                Conversation_js_1.Conversation.countDocuments({ status: 'human_requested' }),
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
                        siteId: c.siteId,
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
    static async getSettings(_req, res, next) {
        try {
            res.json({ success: true, data: await (0, BotSettings_js_1.getBotSettings)() });
        }
        catch (err) {
            next(err);
        }
    }
    static async updateSettings(req, res, next) {
        try {
            const allowed = ['botName', 'tone', 'greetingMessage', 'fallbackMessage', 'confidenceThreshold'];
            const patch = {};
            for (const key of allowed)
                if (req.body[key] !== undefined)
                    patch[key] = req.body[key];
            if ((patch.tone !== undefined && !['friendly', 'professional', 'casual'].includes(String(patch.tone))) ||
                (patch.confidenceThreshold !== undefined && (typeof patch.confidenceThreshold !== 'number' || patch.confidenceThreshold < 0 || patch.confidenceThreshold > 1)) ||
                ['botName', 'greetingMessage', 'fallbackMessage'].some((key) => patch[key] !== undefined && (typeof patch[key] !== 'string' || !patch[key].trim() || patch[key].length > 1000))) {
                res.status(400).json({ success: false, message: 'Invalid settings.' });
                return;
            }
            const settings = await BotSettings_js_1.BotSettings.findOneAndUpdate({ key: 'default' }, { $set: patch }, { upsert: true, new: true, runValidators: true });
            res.json({ success: true, data: settings });
        }
        catch (err) {
            next(err);
        }
    }
    static async getKnowledgeGaps(_req, res, next) {
        try {
            const gaps = await UnansweredQuery_js_1.UnansweredQuery.find({ resolved: false }).sort({ createdAt: -1 }).limit(100).lean();
            res.json({ success: true, data: gaps.map((g) => ({ id: g._id.toString(), query: g.query, userEmail: g.userEmail, conversationId: g.conversationId.toString(), resolved: g.resolved, createdAt: g.createdAt })) });
        }
        catch (err) {
            next(err);
        }
    }
    static async resolveKnowledgeGap(req, res, next) {
        try {
            const gap = await UnansweredQuery_js_1.UnansweredQuery.findByIdAndUpdate(req.params.id, { resolved: true }, { new: true });
            if (!gap) {
                res.status(404).json({ success: false, message: 'Knowledge gap not found.' });
                return;
            }
            res.json({ success: true, data: gap });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.AdminController = AdminController;
