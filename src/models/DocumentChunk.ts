import mongoose, { Document as MongooseDoc, Schema, Types } from 'mongoose';

export interface IDocumentChunk extends MongooseDoc {
  documentId: Types.ObjectId;
  content: string;
  embedding: number[];
  pageNumber: number;
  chunkIndex: number;
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

export const DocumentChunk = mongoose.model<IDocumentChunk>('DocumentChunk', DocumentChunkSchema);
