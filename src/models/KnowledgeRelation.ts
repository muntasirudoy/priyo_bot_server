import mongoose, { Schema } from 'mongoose';

const RelationSourceSchema = new Schema({
  documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true },
  chunkId: { type: Schema.Types.ObjectId, ref: 'DocumentChunk', required: true },
  pageNumber: { type: Number, required: true },
}, { _id: false });

const KnowledgeRelationSchema = new Schema({
  sourceEntityId: { type: Schema.Types.ObjectId, ref: 'KnowledgeEntity', required: true, index: true },
  predicate: { type: String, required: true },
  targetEntityId: { type: Schema.Types.ObjectId, ref: 'KnowledgeEntity', required: true, index: true },
  confidence: { type: Number, min: 0, max: 1, default: 0.7 },
  sources: { type: [RelationSourceSchema], required: true },
  extractionVersion: { type: String, required: true, default: 'v1' },
}, { timestamps: true });

KnowledgeRelationSchema.index({ sourceEntityId: 1, predicate: 1, targetEntityId: 1 }, { unique: true });
export const KnowledgeRelation = mongoose.model('KnowledgeRelation', KnowledgeRelationSchema);
