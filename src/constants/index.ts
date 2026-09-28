export const CHUNK_CONFIG = {
  CHUNK_SIZE: 600, // characters per chunk
  CHUNK_OVERLAP: 100, // character overlap
  MIN_CHUNK_LENGTH: 40, // ignore tiny leftover chunks
};

export const RAG_CONFIG = {
  MAX_RETRIEVED_CHUNKS: 4,
  DEFAULT_SIMILARITY_THRESHOLD: 0.5,
  MAX_CONTEXT_MESSAGES: 10,
  NO_INFO_FALLBACK: "I couldn't find this information in the available support documents. Please contact our support team for further assistance.",
};

export const HUMAN_ESCALATION_PHRASES = [
  'talk to a human',
  'speak with a human',
  'talk to an agent',
  'speak to an agent',
  'connect me with an agent',
  'human representative',
  'customer support representative',
  'live agent',
  'real person',
  'escalate',
  'agent please',
  'transfer to human',
  'speak with someone',
  'talk to someone',
];
