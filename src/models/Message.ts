import mongoose, { Document as MongooseDoc, Schema, Types } from 'mongoose';
import { MessageRole, SourceReference } from '../types/index.js';

export interface IMessage extends MongooseDoc {
  conversationId: Types.ObjectId;
  role: MessageRole;
  content: string;
  sources: SourceReference[];
  createdAt: Date;
}

const SourceReferenceSchema = new Schema<SourceReference>(
  {
    documentId: { type: String, required: true },
    documentName: { type: String, required: true },
    pageNumber: { type: Number, required: true },
    chunkId: { type: String, required: true },
    similarityScore: { type: Number, required: true },
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['USER', 'ASSISTANT', 'SYSTEM'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    sources: {
      type: [SourceReferenceSchema],
      default: [],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
