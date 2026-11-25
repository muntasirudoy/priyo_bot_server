export type DocumentStatus = 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type ConversationStatus = 'bot' | 'human_requested' | 'agent_active' | 'resolved';
export type MessageRole = 'USER' | 'ASSISTANT' | 'AGENT' | 'SYSTEM';
export type ChatIntent = 'CHITCHAT' | 'KNOWLEDGE_QUERY' | 'HUMAN_NEEDED';
export interface BotSettingsData { botName: string; tone: 'friendly' | 'professional' | 'casual'; greetingMessage: string; fallbackMessage: string; confidenceThreshold: number; }

export interface SourceReference {
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkId: string;
  similarityScore: number;
}

export interface ExpandedQuery {
  original: string;
  standalone: string;
  variants: string[];
  keywords: string[];
  entities: string[];
  contextTopic?: string;
  followUpType?: 'company' | 'role' | 'details' | 'ambiguous' | 'other';
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
  retrievalChannels?: string[];
  fusedScore?: number;
  rerankerScore?: number;
  lexicalScore?: number;
  graphPath?: string[];
}

export interface SearchOptions {
  topK?: number;
  similarityThreshold?: number;
  documentId?: string;
}
