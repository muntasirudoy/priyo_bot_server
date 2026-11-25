import { Request, Response, NextFunction } from 'express';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { DocumentModel } from '../models/Document.js';
import { BotSettings, getBotSettings } from '../models/BotSettings.js';
import { UnansweredQuery } from '../models/UnansweredQuery.js';

export class AdminController {
  public static async getDashboardStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const [
        totalConversations,
        totalQuestions,
        totalAiResponses,
        humanEscalationCount,
        totalDocuments,
        recentConversations,
      ] = await Promise.all([
        Conversation.countDocuments(),
        Message.countDocuments({ role: 'USER' }),
        Message.countDocuments({ role: 'ASSISTANT' }),
        Conversation.countDocuments({ status: 'human_requested' }),
        DocumentModel.countDocuments(),
        Conversation.find().sort({ updatedAt: -1 }).limit(5).lean(),
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
    } catch (err) {
      next(err);
    }
  }
  public static async getSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try { res.json({ success: true, data: await getBotSettings() }); } catch (err) { next(err); }
  }
  public static async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const allowed = ['botName', 'tone', 'greetingMessage', 'fallbackMessage', 'confidenceThreshold'] as const;
      const patch: Record<string, unknown> = {};
      for (const key of allowed) if (req.body[key] !== undefined) patch[key] = req.body[key];
      if ((patch.tone !== undefined && !['friendly', 'professional', 'casual'].includes(String(patch.tone))) ||
        (patch.confidenceThreshold !== undefined && (typeof patch.confidenceThreshold !== 'number' || patch.confidenceThreshold < 0 || patch.confidenceThreshold > 1)) ||
        ['botName', 'greetingMessage', 'fallbackMessage'].some((key) => patch[key] !== undefined && (typeof patch[key] !== 'string' || !(patch[key] as string).trim() || (patch[key] as string).length > 1000))) {
        res.status(400).json({ success: false, message: 'Invalid settings.' }); return;
      }
      const settings = await BotSettings.findOneAndUpdate({ key: 'default' }, { $set: patch }, { upsert: true, new: true, runValidators: true });
      res.json({ success: true, data: settings });
    } catch (err) { next(err); }
  }
  public static async getKnowledgeGaps(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try { const gaps = await UnansweredQuery.find({ resolved: false }).sort({ createdAt: -1 }).limit(100).lean(); res.json({ success: true, data: gaps.map((g) => ({ id: g._id.toString(), query: g.query, userEmail: g.userEmail, conversationId: g.conversationId.toString(), resolved: g.resolved, createdAt: g.createdAt })) }); } catch (err) { next(err); }
  }
  public static async resolveKnowledgeGap(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { const gap = await UnansweredQuery.findByIdAndUpdate(req.params.id, { resolved: true }, { new: true }); if (!gap) { res.status(404).json({ success: false, message: 'Knowledge gap not found.' }); return; } res.json({ success: true, data: gap }); } catch (err) { next(err); }
  }
}
