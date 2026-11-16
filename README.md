# Priyo Bot Server

The knowledge pipeline supports multilingual (Bangla, English and Banglish) hybrid RAG and a MongoDB-backed knowledge graph.

## Retrieval pipeline

1. PDF text is cleaned, section-aware metadata is retained, and chunks are embedded.
2. The current question and recent conversation are rewritten into a standalone multilingual query.
3. Dense semantic, lexical and up-to-two-hop graph candidates are combined with reciprocal-rank fusion.
4. Gemini reranks the candidates and generates a source-grounded response in the customer's language.

Production never uses deterministic fallback embeddings. If Gemini embedding is unavailable, ingestion/query processing fails instead of silently producing low-quality semantic results.

## Reindexing

After changing `GEMINI_EMBEDDING_MODEL` or `EMBEDDING_VERSION`, reindex every existing PDF. An authenticated admin can call `POST /api/documents/:id/reindex`; progress is exposed through `status`, `graphStatus`, `processingError`, and `graphError` on the document APIs. The existing `src/scripts/reembed.ts` script can reprocess all documents.

## Validation

Run `npm test` and `npm run build`. End-to-end verification requires a running server, MongoDB, a reachable Gemini API, and `tsx src/tests/verifyEndToEnd.ts`.

## Embedding the chatbot

Add the framework-independent loader to any approved website:

```html
<script src="https://your-chat-client.example/widget.js"
  data-site-id="main-store"
  data-title="Customer Support"
  data-primary-color="#dc2626"
  data-position="bottom-right"></script>
```

By default, an empty `VITE_ALLOWED_EMBED_ORIGINS` allows any website to embed the widget. Later, set it to a comma-separated list of trusted origins and rebuild the client to enable restricted mode. `ALLOWED_EMBED_ORIGINS` is only needed when a host calls the API directly across origins; the iframe normally uses the chatbot client origin. Host sites with a Content Security Policy must allow the chatbot origin in `script-src` and `frame-src`. Widget lifecycle events are dispatched on `window` as `priyo-chat:ready`, `priyo-chat:open`, `priyo-chat:close`, `priyo-chat:unread-count`, and `priyo-chat:reset-session`.
