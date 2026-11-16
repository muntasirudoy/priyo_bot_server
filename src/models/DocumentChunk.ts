import mongoose, { Document as MongooseDoc, Schema, Types } from 'mongoose';

export interface IDocumentChunk extends MongooseDoc {
  documentId: Types.ObjectId;
  content: string;
  embedding: number[];
  pageNumber: number;
  chunkIndex: number;
  sectionTitle?: string;
  keywords: string[];
  embeddingModel: string;
  embeddingVersion: string;
  embeddingDimension: number;
  ingestionVersion: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const DocumentChunkSchema = new Schema<IDocumentChunk>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number],
      required: true,
    },
    pageNumber: {
      type: Number,
      required: true,
      default: 1,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    sectionTitle: { type: String, default: '' },
    keywords: { type: [String], default: [] },
    embeddingModel: { type: String, required: true, default: 'legacy' },
    embeddingVersion: { type: String, required: true, default: 'legacy' },
    embeddingDimension: { type: Number, required: true, default: 0 },
    ingestionVersion: { type: String, required: true, default: 'v1' },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

DocumentChunkSchema.index({ documentId: 1, chunkIndex: 1 });
DocumentChunkSchema.index({ content: 'text', keywords: 'text', sectionTitle: 'text' });

export const DocumentChunk = mongoose.model<IDocumentChunk>('DocumentChunk', DocumentChunkSchema);
