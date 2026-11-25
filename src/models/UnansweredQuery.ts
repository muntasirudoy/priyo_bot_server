import mongoose, { Schema, Document as MongooseDoc, Types } from 'mongoose';
export interface IUnansweredQuery extends MongooseDoc {
  query: string; userEmail: string; conversationId: Types.ObjectId; resolved: boolean; createdAt: Date;
}
const schema = new Schema<IUnansweredQuery>({
  query: { type: String, required: true }, userEmail: { type: String, required: true, index: true },
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  resolved: { type: Boolean, default: false, index: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
export const UnansweredQuery = mongoose.model<IUnansweredQuery>('UnansweredQuery', schema);
