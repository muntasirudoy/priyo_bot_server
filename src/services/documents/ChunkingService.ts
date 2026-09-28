import { CHUNK_CONFIG } from '../../constants/index.js';
import { ChunkData } from '../../types/index.js';
import { cleanText } from '../../utils/textCleaner.js';

export interface PageText {
  pageNumber: number;
  text: string;
}

export class ChunkingService {
  /**
   * Chunks multiple pages of text while preserving page numbers, chunk indices,
   * and paragraph/sentence boundaries.
   */
  public static chunkPages(
    pages: PageText[],
    chunkSize: number = CHUNK_CONFIG.CHUNK_SIZE,
    chunkOverlap: number = CHUNK_CONFIG.CHUNK_OVERLAP
  ): ChunkData[] {
    const allChunks: ChunkData[] = [];
    let globalChunkIndex = 0;

    for (const page of pages) {
      const cleanedPageText = cleanText(page.text);
      if (!cleanedPageText) continue;

      const pageChunks = this.chunkSingleText(
        cleanedPageText,
        page.pageNumber,
        globalChunkIndex,
        chunkSize,
        chunkOverlap
      );

      allChunks.push(...pageChunks);
      globalChunkIndex += pageChunks.length;
    }

    return allChunks;
  }

  /**
   * Chunks a single block of text (e.g. from a page) respecting paragraph and sentence boundaries.
   */
  public static chunkSingleText(
    text: string,
    pageNumber: number,
    startingIndex: number = 0,
    chunkSize: number = CHUNK_CONFIG.CHUNK_SIZE,
    chunkOverlap: number = CHUNK_CONFIG.CHUNK_OVERLAP
  ): ChunkData[] {
    const chunks: ChunkData[] = [];
    const paragraphs = text.split(/\n\s*\n/);

    let currentBuffer = '';
    let currentIndex = startingIndex;

    for (const paragraph of paragraphs) {
      const cleanPara = paragraph.trim();
      if (!cleanPara) continue;

      // If a single paragraph is larger than chunkSize, split it by sentence
      if (cleanPara.length > chunkSize) {
        // Flush any existing buffer first
        if (currentBuffer.trim().length >= CHUNK_CONFIG.MIN_CHUNK_LENGTH) {
          chunks.push({
            content: currentBuffer.trim(),
            pageNumber,
            chunkIndex: currentIndex++,
          });
          currentBuffer = this.getOverlapSubstring(currentBuffer, chunkOverlap);
        }

        const sentences = cleanPara.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [cleanPara];

        for (const sentence of sentences) {
          const cleanSentence = sentence.trim();
          if (!cleanSentence) continue;

          if (currentBuffer.length + cleanSentence.length + 1 > chunkSize) {
            if (currentBuffer.trim().length >= CHUNK_CONFIG.MIN_CHUNK_LENGTH) {
              chunks.push({
                content: currentBuffer.trim(),
                pageNumber,
                chunkIndex: currentIndex++,
              });
              currentBuffer = this.getOverlapSubstring(currentBuffer, chunkOverlap);
            }
          }

          currentBuffer += (currentBuffer ? ' ' : '') + cleanSentence;
        }
      } else {
        // Normal paragraph fit
        if (currentBuffer.length + cleanPara.length + 2 > chunkSize) {
          if (currentBuffer.trim().length >= CHUNK_CONFIG.MIN_CHUNK_LENGTH) {
            chunks.push({
              content: currentBuffer.trim(),
              pageNumber,
              chunkIndex: currentIndex++,
            });
            currentBuffer = this.getOverlapSubstring(currentBuffer, chunkOverlap);
          }
        }

        currentBuffer += (currentBuffer ? '\n\n' : '') + cleanPara;
      }
    }

    // Push remaining buffer
    if (currentBuffer.trim().length >= CHUNK_CONFIG.MIN_CHUNK_LENGTH) {
      chunks.push({
        content: currentBuffer.trim(),
        pageNumber,
        chunkIndex: currentIndex++,
      });
    }

    return chunks;
  }

  private static getOverlapSubstring(text: string, overlapLength: number): string {
    if (text.length <= overlapLength) return '';
    const slice = text.slice(-overlapLength);
    // Try to cut at the nearest space boundary to avoid word fragmentation
    const firstSpace = slice.indexOf(' ');
    if (firstSpace !== -1 && firstSpace < slice.length / 2) {
      return slice.slice(firstSpace + 1);
    }
    return slice;
  }
}
