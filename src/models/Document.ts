import mongoose, { Document as MongooseDoc, Schema } from 'mongoose';
import { DocumentStatus } from '../types/index.js';

export interface IDocument extends MongooseDoc {
  filename: string;
  originalName: string;
  fileUrl: string;
  status: DocumentStatus;
  totalChunks: number;
  processingError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'UPLOADING',
      required: true,
    },
    totalChunks: {
      type: Number,
      default: 0,
    },
    processingError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const DocumentModel = mongoose.model<IDocument>('Document', DocumentSchema);
