import mongoose, { Schema, Types } from 'mongoose';

export interface IKnowledgeSource {
  documentId: Types.ObjectId;
  chunkId: Types.ObjectId;
  pageNumber: number;
}

const SourceSchema = new Schema<IKnowledgeSource>({
  documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true },
  chunkId: { type: Schema.Types.ObjectId, ref: 'DocumentChunk', required: true },
  pageNumber: { type: Number, required: true },
}, { _id: false });

const KnowledgeEntitySchema = new Schema({
  canonicalName: { type: String, required: true },
  normalizedName: { type: String, required: true, unique: true, index: true },
  type: { type: String, required: true },
  aliases: { type: [String], default: [] },
  description: { type: String, default: '' },
  sources: { type: [SourceSchema], default: [] },
  extractionVersion: { type: String, required: true, default: 'v1' },
}, { timestamps: true });

KnowledgeEntitySchema.index({ canonicalName: 'text', aliases: 'text', description: 'text' });
export const KnowledgeEntity = mongoose.model('KnowledgeEntity', KnowledgeEntitySchema);
