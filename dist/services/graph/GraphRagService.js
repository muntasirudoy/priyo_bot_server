"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphRagService = void 0;
const gemini_js_1 = require("../../config/gemini.js");
const env_js_1 = require("../../config/env.js");
const KnowledgeEntity_js_1 = require("../../models/KnowledgeEntity.js");
const KnowledgeRelation_js_1 = require("../../models/KnowledgeRelation.js");
const DocumentChunk_js_1 = require("../../models/DocumentChunk.js");
class GraphRagService {
    static normalize(value) { return value.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
    static async indexDocument(documentId) {
        if (!(0, gemini_js_1.isGeminiConfigured)())
            return;
        const chunks = await DocumentChunk_js_1.DocumentChunk.find({ documentId }).lean();
        for (const chunk of chunks) {
            try {
                const model = (0, gemini_js_1.getGeminiClient)().getGenerativeModel({ model: env_js_1.ENV.GEMINI_TEXT_MODEL, generationConfig: { temperature: 0, responseMimeType: 'application/json' } });
                const prompt = `Extract a customer-support knowledge graph. Return JSON only: {"entities":[{"name":"","type":"product|service|plan|feature|policy|process|requirement|fee|duration|channel|organization","aliases":[],"description":""}],"relations":[{"source":"exact entity name","predicate":"short relationship","target":"exact entity name","confidence":0.0}]}. Only include facts explicitly supported by this text:\n${chunk.content}`;
                const parsed = JSON.parse((await model.generateContent(prompt)).response.text());
                const map = new Map();
                for (const entity of (parsed.entities || []).slice(0, 20)) {
                    const normalizedName = this.normalize(entity.name || '');
                    if (!normalizedName)
                        continue;
                    const source = { documentId: chunk.documentId, chunkId: chunk._id, pageNumber: chunk.pageNumber };
                    const saved = await KnowledgeEntity_js_1.KnowledgeEntity.findOneAndUpdate({ normalizedName }, {
                        $setOnInsert: { canonicalName: entity.name, normalizedName, type: entity.type || 'concept', extractionVersion: 'v1' },
                        $set: { description: entity.description || '' }, $addToSet: { aliases: { $each: entity.aliases || [] }, sources: source },
                    }, { upsert: true, new: true });
                    map.set(normalizedName, saved._id);
                }
                for (const relation of (parsed.relations || []).slice(0, 30)) {
                    const sourceEntityId = map.get(this.normalize(relation.source || ''));
                    const targetEntityId = map.get(this.normalize(relation.target || ''));
                    if (!sourceEntityId || !targetEntityId || !relation.predicate)
                        continue;
                    const source = { documentId: chunk.documentId, chunkId: chunk._id, pageNumber: chunk.pageNumber };
                    await KnowledgeRelation_js_1.KnowledgeRelation.findOneAndUpdate({ sourceEntityId, predicate: relation.predicate, targetEntityId }, {
                        $set: { confidence: Math.max(0, Math.min(1, relation.confidence ?? 0.7)) }, $addToSet: { sources: source }, $setOnInsert: { extractionVersion: 'v1' },
                    }, { upsert: true });
                }
            }
            catch (error) {
                console.warn(`Graph extraction skipped for chunk ${chunk._id}:`, error);
            }
        }
    }
    static async retrieve(query, maxHops = 2) {
        const needles = [...query.entities, ...query.keywords].map((x) => this.normalize(x)).filter((x) => x.length > 2).slice(0, 20);
        if (!needles.length)
            return new Map();
        const escaped = needles.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const entities = await KnowledgeEntity_js_1.KnowledgeEntity.find({ $or: escaped.flatMap((value) => [{ normalizedName: { $regex: value, $options: 'i' } }, { aliases: { $regex: value, $options: 'i' } }]) }).limit(12).lean();
        let frontier = entities.map((e) => e._id);
        const visited = new Set(frontier.map(String));
        const paths = new Map();
        for (const e of entities)
            for (const s of e.sources || [])
                paths.set(String(s.chunkId), [e.canonicalName]);
        for (let hop = 0; hop < maxHops && frontier.length; hop++) {
            const relations = await KnowledgeRelation_js_1.KnowledgeRelation.find({ $or: [{ sourceEntityId: { $in: frontier } }, { targetEntityId: { $in: frontier } }] }).limit(50).lean();
            const ids = [...new Set(relations.flatMap((r) => [String(r.sourceEntityId), String(r.targetEntityId)]))];
            const names = new Map((await KnowledgeEntity_js_1.KnowledgeEntity.find({ _id: { $in: ids } }).select('_id canonicalName').lean()).map((e) => [String(e._id), e.canonicalName]));
            const next = [];
            for (const r of relations) {
                const path = [names.get(String(r.sourceEntityId)) || '', r.predicate, names.get(String(r.targetEntityId)) || ''];
                for (const s of r.sources || [])
                    paths.set(String(s.chunkId), path);
                for (const id of [r.sourceEntityId, r.targetEntityId])
                    if (!visited.has(String(id))) {
                        visited.add(String(id));
                        next.push(id);
                    }
            }
            frontier = next;
        }
        return paths;
    }
    static async deleteDocument(documentId) {
        await KnowledgeRelation_js_1.KnowledgeRelation.updateMany({}, { $pull: { sources: { documentId } } });
        await KnowledgeEntity_js_1.KnowledgeEntity.updateMany({}, { $pull: { sources: { documentId } } });
        await KnowledgeRelation_js_1.KnowledgeRelation.deleteMany({ sources: { $size: 0 } });
        await KnowledgeEntity_js_1.KnowledgeEntity.deleteMany({ sources: { $size: 0 } });
    }
}
exports.GraphRagService = GraphRagService;
