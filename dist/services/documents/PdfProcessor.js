"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfProcessor = void 0;
const fs_1 = __importDefault(require("fs"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const Document_js_1 = require("../../models/Document.js");
const DocumentChunk_js_1 = require("../../models/DocumentChunk.js");
const ChunkingService_js_1 = require("./ChunkingService.js");
const EmbeddingService_js_1 = require("../embedding/EmbeddingService.js");
class PdfProcessor {
    /**
     * Processes an uploaded PDF asynchronously in the background.
     */
    static async processDocumentAsync(documentId, filePath) {
        // Run in background without awaiting in the controller
        setImmediate(async () => {
            await this.executeProcessing(documentId, filePath);
        });
    }
    /**
     * Executes the PDF parsing, text extraction, chunking, embedding generation, and DB persistence.
     */
    static async executeProcessing(documentId, filePath) {
        try {
            console.log(`📄 Starting processing for document ID: ${documentId}`);
            // Set status to PROCESSING
            await Document_js_1.DocumentModel.findByIdAndUpdate(documentId, {
                status: 'PROCESSING',
                processingError: null,
            });
            if (!fs_1.default.existsSync(filePath)) {
                throw new Error(`File not found at path: ${filePath}`);
            }
            const dataBuffer = fs_1.default.readFileSync(filePath);
            // Extract text preserving pages
            const pages = [];
            const renderPage = (pageData) => {
                return pageData.getTextContent().then((textContent) => {
                    let lastY;
                    let text = '';
                    for (const item of textContent.items) {
                        if (lastY === undefined || lastY === item.transform[5]) {
                            text += item.str;
                        }
                        else {
                            text += '\n' + item.str;
                        }
                        lastY = item.transform[5];
                    }
                    pages.push({
                        pageNumber: (pageData.pageIndex || 0) + 1,
                        text,
                    });
                    return text;
                });
            };
            const pdfData = await (0, pdf_parse_1.default)(dataBuffer, { pagerender: renderPage });
            // If page render did not capture separate pages (e.g. simple 1-page PDF or fallback), use full text
            if (pages.length === 0) {
                pages.push({
                    pageNumber: 1,
                    text: pdfData.text || '',
                });
            }
            // Sort pages by pageNumber
            pages.sort((a, b) => a.pageNumber - b.pageNumber);
            // Validate that there is extractable text
            const totalChars = pages.reduce((sum, p) => sum + p.text.trim().length, 0);
            if (totalChars === 0) {
                throw new Error('No extractable text found in PDF. Scanned or image-only PDFs are not supported without OCR.');
            }
            console.log(`📄 Extracted ${pages.length} page(s) from document ${documentId}`);
            // 8. & 9. Clean & split text into meaningful chunks
            const chunks = ChunkingService_js_1.ChunkingService.chunkPages(pages);
            if (chunks.length === 0) {
                throw new Error('Extracted text was insufficient to generate document chunks.');
            }
            console.log(`🧩 Created ${chunks.length} chunk(s) for document ${documentId}`);
            // 10. Generate embeddings using Gemini Embedding Model
            const chunkTexts = chunks.map((c) => c.content);
            console.log(`🤖 Generating embeddings for ${chunkTexts.length} chunks...`);
            const embeddings = await EmbeddingService_js_1.EmbeddingService.generateEmbeddings(chunkTexts);
            // 11. Store chunks and embeddings in MongoDB
            const chunkDocs = chunks.map((chunk, index) => ({
                documentId,
                content: chunk.content,
                embedding: embeddings[index],
                pageNumber: chunk.pageNumber,
                chunkIndex: chunk.chunkIndex,
                metadata: {
                    charLength: chunk.content.length,
                    generatedAt: new Date(),
                },
            }));
            // Delete any pre-existing chunks for this document if re-processing
            await DocumentChunk_js_1.DocumentChunk.deleteMany({ documentId });
            await DocumentChunk_js_1.DocumentChunk.insertMany(chunkDocs);
            // 12. Update Document status to COMPLETED
            await Document_js_1.DocumentModel.findByIdAndUpdate(documentId, {
                status: 'COMPLETED',
                totalChunks: chunkDocs.length,
                processingError: null,
            });
            console.log(`✅ Document ${documentId} processed successfully with ${chunkDocs.length} chunks.`);
        }
        catch (error) {
            console.error(`❌ PDF Processing failed for document ${documentId}:`, error);
            const errorMessage = error?.message || 'Unknown error occurred while processing PDF.';
            await Document_js_1.DocumentModel.findByIdAndUpdate(documentId, {
                status: 'FAILED',
                processingError: errorMessage,
            });
        }
    }
}
exports.PdfProcessor = PdfProcessor;
