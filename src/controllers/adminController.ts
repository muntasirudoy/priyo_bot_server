import { Request, Response, NextFunction } from 'express';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { DocumentModel } from '../models/Document.js';

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
        Conversation.countDocuments({ status: 'HUMAN_REQUIRED' }),
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
}
