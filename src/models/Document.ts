import mongoose, { Document as MongooseDoc, Schema } from 'mongoose';
import { DocumentStatus } from '../types/index.js';

export interface IDocument extends MongooseDoc {
  filename: string;
  originalName: string;
  fileUrl: string;
  status: DocumentStatus;
  totalChunks: number;
  processingError?: string;
  graphStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  graphError?: string;
  ingestionVersion: string;
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
    graphStatus: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
    },
    graphError: { type: String, default: null },
    ingestionVersion: { type: String, default: 'v1' },
  },
  {
    timestamps: true,
  }
);

export const DocumentModel = mongoose.model<IDocument>('Document', DocumentSchema);
