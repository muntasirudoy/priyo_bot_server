import fs from 'fs';
import pdfParse from 'pdf-parse';
import { DocumentModel } from '../../models/Document.js';
import { DocumentChunk } from '../../models/DocumentChunk.js';
import { ChunkingService, PageText } from './ChunkingService.js';
import { EmbeddingService } from '../embedding/EmbeddingService.js';

export class PdfProcessor {
  /**
   * Processes an uploaded PDF asynchronously in the background.
   */
  public static async processDocumentAsync(documentId: string, filePath: string): Promise<void> {
    // Run in background without awaiting in the controller
    setImmediate(async () => {
      await this.executeProcessing(documentId, filePath);
    });
  }

  /**
   * Executes the PDF parsing, text extraction, chunking, embedding generation, and DB persistence.
   */
  public static async executeProcessing(documentId: string, filePath: string): Promise<void> {
    try {
      console.log(`📄 Starting processing for document ID: ${documentId}`);

      // Set status to PROCESSING
      await DocumentModel.findByIdAndUpdate(documentId, {
        status: 'PROCESSING',
        processingError: null,
      });

      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found at path: ${filePath}`);
      }

      const dataBuffer = fs.readFileSync(filePath);

      // Extract text preserving pages
      const pages: PageText[] = [];

      const renderPage = (pageData: any) => {
        return pageData.getTextContent().then((textContent: any) => {
          let lastY: number | undefined;
          let text = '';
          for (const item of textContent.items) {
            if (lastY === undefined || lastY === item.transform[5]) {
              text += item.str;
            } else {
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

      const pdfData = await pdfParse(dataBuffer, { pagerender: renderPage });

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
      const chunks = ChunkingService.chunkPages(pages);

      if (chunks.length === 0) {
        throw new Error('Extracted text was insufficient to generate document chunks.');
      }

      console.log(`🧩 Created ${chunks.length} chunk(s) for document ${documentId}`);

      // 10. Generate embeddings using Gemini Embedding Model
      const chunkTexts = chunks.map((c) => c.content);
      console.log(`🤖 Generating embeddings for ${chunkTexts.length} chunks...`);
      const embeddings = await EmbeddingService.generateEmbeddings(chunkTexts);

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
      await DocumentChunk.deleteMany({ documentId });
      await DocumentChunk.insertMany(chunkDocs);

      // 12. Update Document status to COMPLETED
      await DocumentModel.findByIdAndUpdate(documentId, {
        status: 'COMPLETED',
        totalChunks: chunkDocs.length,
        processingError: null,
      });

      console.log(`✅ Document ${documentId} processed successfully with ${chunkDocs.length} chunks.`);
    } catch (error: any) {
      console.error(`❌ PDF Processing failed for document ${documentId}:`, error);
      const errorMessage = error?.message || 'Unknown error occurred while processing PDF.';

      await DocumentModel.findByIdAndUpdate(documentId, {
        status: 'FAILED',
        processingError: errorMessage,
      });
    }
  }
}
