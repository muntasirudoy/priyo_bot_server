import mongoose, { Document as MongooseDoc, Schema } from 'mongoose';
import { ConversationStatus } from '../types/index.js';

export interface IConversation extends MongooseDoc {
  sessionId: string;
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
    status: {
      type: String,
      enum: ['ACTIVE', 'HUMAN_REQUIRED', 'CLOSED'],
      default: 'ACTIVE',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
