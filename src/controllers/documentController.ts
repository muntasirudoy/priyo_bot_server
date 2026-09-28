import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { DocumentModel } from '../models/Document.js';
import { DocumentChunk } from '../models/DocumentChunk.js';
import { PdfProcessor } from '../services/documents/PdfProcessor.js';
import { ENV } from '../config/env.js';

// Ensure uploads directory exists
if (!fs.existsSync(ENV.UPLOAD_DIR)) {
  fs.mkdirSync(ENV.UPLOAD_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ENV.UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'));
    }
  },
});

export class DocumentController {
  public static async uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No PDF file uploaded.',
          code: 'FILE_REQUIRED',
        });
        return;
      }

      const filePath = req.file.path;
      const originalName = req.file.originalname;
      const filename = req.file.filename;

      // 4. Create Document record
      const document = await DocumentModel.create({
        filename,
        originalName,
        fileUrl: filePath,
        status: 'PROCESSING',
        totalChunks: 0,
        processingError: null,
      });

      // 5. Trigger asynchronous processing without blocking the response
      PdfProcessor.processDocumentAsync(document._id.toString(), filePath);

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully and processing started.',
        data: {
          document: {
            id: document._id,
            originalName: document.originalName,
            status: document.status,
            createdAt: document.createdAt,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async listDocuments(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const documents = await DocumentModel.find().sort({ createdAt: -1 }).lean();

      res.json({
        success: true,
        data: {
          documents: documents.map((doc) => ({
            id: doc._id.toString(),
            originalName: doc.originalName,
            filename: doc.filename,
            status: doc.status,
            totalChunks: doc.totalChunks,
            processingError: doc.processingError,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const document = await DocumentModel.findById(id).lean();

      if (!document) {
        res.status(404).json({
          success: false,
          message: 'Document not found.',
          code: 'DOCUMENT_NOT_FOUND',
        });
        return;
      }

      const chunkCount = await DocumentChunk.countDocuments({ documentId: document._id });

      res.json({
        success: true,
        data: {
          document: {
            id: document._id.toString(),
            originalName: document.originalName,
            filename: document.filename,
            status: document.status,
            totalChunks: chunkCount,
            processingError: document.processingError,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const document = await DocumentModel.findById(id);

      if (!document) {
        res.status(404).json({
          success: false,
          message: 'Document not found.',
          code: 'DOCUMENT_NOT_FOUND',
        });
        return;
      }

      // 1. Delete associated chunks from database
      const deleteResult = await DocumentChunk.deleteMany({ documentId: document._id });
      console.log(`Deleted ${deleteResult.deletedCount} chunks for document ${id}`);

      // 2. Delete file from filesystem if exists
      if (document.fileUrl && fs.existsSync(document.fileUrl)) {
        try {
          fs.unlinkSync(document.fileUrl);
        } catch (fileErr) {
          console.warn(`Could not delete file ${document.fileUrl}:`, fileErr);
        }
      }

      // 3. Delete Document record
      await DocumentModel.findByIdAndDelete(id);

      res.json({
        success: true,
        message: 'Document and all associated chunks deleted successfully.',
        data: {
          deletedChunksCount: deleteResult.deletedCount,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
