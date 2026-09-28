export type DocumentStatus = 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type ConversationStatus = 'ACTIVE' | 'HUMAN_REQUIRED' | 'CLOSED';
export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface SourceReference {
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkId: string;
  similarityScore: number;
}

export interface StructuredAiResponse {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  needsHuman: boolean;
}

export interface ChunkMetadata {
  pageNumber: number;
  chunkIndex: number;
  totalChunksInPage?: number;
  tokenCount?: number;
}

export interface ChunkData {
  content: string;
  pageNumber: number;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}

export interface VectorSearchResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
  similarityScore: number;
}

export interface SearchOptions {
  topK?: number;
  similarityThreshold?: number;
  documentId?: string;
}
