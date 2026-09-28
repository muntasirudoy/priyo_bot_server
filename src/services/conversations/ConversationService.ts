import { Conversation, IConversation } from '../../models/Conversation.js';
import { Message, IMessage } from '../../models/Message.js';
import { SourceReference, ConversationStatus } from '../../types/index.js';
import { Types } from 'mongoose';

export class ConversationService {
  /**
   * Find existing conversation by sessionId or create a new one.
   */
  public static async getOrCreateConversation(sessionId: string): Promise<IConversation> {
    let conversation = await Conversation.findOne({ sessionId });
    if (!conversation) {
      conversation = await Conversation.create({
        sessionId,
        status: 'ACTIVE',
      });
    }
    return conversation;
  }

  /**
   * Add a message to a conversation.
   */
  public static async addMessage(
    conversationId: Types.ObjectId | string,
    role: 'USER' | 'ASSISTANT' | 'SYSTEM',
    content: string,
    sources: SourceReference[] = []
  ): Promise<IMessage> {
    const message = await Message.create({
      conversationId: new Types.ObjectId(conversationId),
      role,
      content,
      sources,
    });

    // Touch the conversation updatedAt
    await Conversation.findByIdAndUpdate(conversationId, { updatedAt: new Date() });

    return message;
  }

  /**
   * Get recent messages for a conversation.
   */
  public static async getMessages(conversationId: Types.ObjectId | string, limit = 50): Promise<IMessage[]> {
    return Message.find({ conversationId: new Types.ObjectId(conversationId) })
      .sort({ createdAt: 1 })
      .limit(limit);
  }

  /**
   * Update conversation status (e.g. to HUMAN_REQUIRED).
   */
  public static async updateStatus(
    conversationId: Types.ObjectId | string,
    status: ConversationStatus
  ): Promise<IConversation | null> {
    return Conversation.findByIdAndUpdate(
      conversationId,
      { status },
      { new: true }
    );
  }

  /**
   * List all conversations with summary information for Admin view.
   */
  public static async listConversationsForAdmin(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const conversations = await Conversation.find()
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Conversation.countDocuments();

    // Populate last question and message counts
    const populated = await Promise.all(
      conversations.map(async (conv) => {
        const lastUserMsg = await Message.findOne({
          conversationId: conv._id,
          role: 'USER',
        })
          .sort({ createdAt: -1 })
          .select('content createdAt')
          .lean();

        const messageCount = await Message.countDocuments({ conversationId: conv._id });

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
      })
    );

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
  public static async getConversationDetails(conversationId: string) {
    const conversation = await Conversation.findById(conversationId).lean();
    if (!conversation) {
      return null;
    }

    const messages = await Message.find({ conversationId: conversation._id })
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
