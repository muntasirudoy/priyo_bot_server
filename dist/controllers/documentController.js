"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentController = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const Document_js_1 = require("../models/Document.js");
const DocumentChunk_js_1 = require("../models/DocumentChunk.js");
const PdfProcessor_js_1 = require("../services/documents/PdfProcessor.js");
const env_js_1 = require("../config/env.js");
// Ensure uploads directory exists
if (!fs_1.default.existsSync(env_js_1.ENV.UPLOAD_DIR)) {
    fs_1.default.mkdirSync(env_js_1.ENV.UPLOAD_DIR, { recursive: true });
}
// Multer storage configuration
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, env_js_1.ENV.UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path_1.default.extname(file.originalname);
        cb(null, `doc-${uniqueSuffix}${ext}`);
    },
});
exports.upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (_req, file, cb) => {
        const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
        if (isPdf) {
            cb(null, true);
        }
        else {
            cb(new Error('Only PDF files are allowed.'));
        }
    },
});
class DocumentController {
    static async uploadDocument(req, res, next) {
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
            const document = await Document_js_1.DocumentModel.create({
                filename,
                originalName,
                fileUrl: filePath,
                status: 'PROCESSING',
                totalChunks: 0,
                processingError: null,
            });
            // 5. Trigger asynchronous processing without blocking the response
            PdfProcessor_js_1.PdfProcessor.processDocumentAsync(document._id.toString(), filePath);
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
        }
        catch (err) {
            next(err);
        }
    }
    static async listDocuments(_req, res, next) {
        try {
            const documents = await Document_js_1.DocumentModel.find().sort({ createdAt: -1 }).lean();
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
        }
        catch (err) {
            next(err);
        }
    }
    static async getDocument(req, res, next) {
        try {
            const { id } = req.params;
            const document = await Document_js_1.DocumentModel.findById(id).lean();
            if (!document) {
                res.status(404).json({
                    success: false,
                    message: 'Document not found.',
                    code: 'DOCUMENT_NOT_FOUND',
                });
                return;
            }
            const chunkCount = await DocumentChunk_js_1.DocumentChunk.countDocuments({ documentId: document._id });
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
        }
        catch (err) {
            next(err);
        }
    }
    static async deleteDocument(req, res, next) {
        try {
            const { id } = req.params;
            const document = await Document_js_1.DocumentModel.findById(id);
            if (!document) {
                res.status(404).json({
                    success: false,
                    message: 'Document not found.',
                    code: 'DOCUMENT_NOT_FOUND',
                });
                return;
            }
            // 1. Delete associated chunks from database
            const deleteResult = await DocumentChunk_js_1.DocumentChunk.deleteMany({ documentId: document._id });
            console.log(`Deleted ${deleteResult.deletedCount} chunks for document ${id}`);
            // 2. Delete file from filesystem if exists
            if (document.fileUrl && fs_1.default.existsSync(document.fileUrl)) {
                try {
                    fs_1.default.unlinkSync(document.fileUrl);
                }
                catch (fileErr) {
                    console.warn(`Could not delete file ${document.fileUrl}:`, fileErr);
                }
            }
            // 3. Delete Document record
            await Document_js_1.DocumentModel.findByIdAndDelete(id);
            res.json({
                success: true,
                message: 'Document and all associated chunks deleted successfully.',
                data: {
                    deletedChunksCount: deleteResult.deletedCount,
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.DocumentController = DocumentController;
