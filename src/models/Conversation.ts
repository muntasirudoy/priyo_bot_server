import mongoose, { Document as MongooseDoc, Schema } from 'mongoose';
import { ConversationStatus } from '../types/index.js';

export interface IConversation extends MongooseDoc {
  sessionId: string;
  siteId?: string;
  userEmail: string;
  userName?: string;
  status: ConversationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    siteId: { type: String, trim: true, maxlength: 100, default: 'default', index: true },
    userEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    userName: { type: String, trim: true, maxlength: 120 },
    status: {
      type: String,
      enum: ['bot', 'human_requested', 'agent_active', 'resolved'],
      default: 'bot',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
