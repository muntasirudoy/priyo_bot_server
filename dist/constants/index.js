"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HUMAN_ESCALATION_PHRASES = exports.MULTILINGUAL_TERM_GROUPS = exports.RAG_CONFIG = exports.CHUNK_CONFIG = void 0;
exports.CHUNK_CONFIG = {
    CHUNK_SIZE: 600, // characters per chunk
    CHUNK_OVERLAP: 100, // character overlap
    MIN_CHUNK_LENGTH: 40, // ignore tiny leftover chunks
};
exports.RAG_CONFIG = {
    MAX_RETRIEVED_CHUNKS: 6,
    DENSE_CANDIDATES: 16,
    LEXICAL_CANDIDATES: 16,
    DEFAULT_SIMILARITY_THRESHOLD: 0.25,
    RRF_K: 60,
    MAX_GRAPH_HOPS: 2,
    MAX_CONTEXT_MESSAGES: 10,
    NO_INFO_FALLBACK: "I couldn't find this information in the available support documents. Please contact our support team for further assistance.",
};
exports.MULTILINGUAL_TERM_GROUPS = [
    ['refund', 'return', 'ফেরত', 'রিফান্ড', 'ferot', 'taka ferot'],
    ['delivery', 'shipping', 'ডেলিভারি', 'পেুঁছানো', 'pathano', 'kobe pabo'],
    ['price', 'cost', 'fee', 'দাম', 'খরচ', 'khoroch'],
    ['cancel', 'cancellation', 'বাতিল', 'batil'],
    ['warranty', 'guarantee', 'ওয়ারেন্টি', 'গ্যারান্টি'],
    ['support', 'help', 'সাহায্য', 'shahajjo'],
];
exports.HUMAN_ESCALATION_PHRASES = [
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
