import { Types } from 'mongoose';
import { getGeminiClient, isGeminiConfigured } from '../../config/gemini.js';
import { ENV } from '../../config/env.js';
import { KnowledgeEntity } from '../../models/KnowledgeEntity.js';
import { KnowledgeRelation } from '../../models/KnowledgeRelation.js';
import { DocumentChunk } from '../../models/DocumentChunk.js';
import { ExpandedQuery } from '../../types/index.js';

type Entity = { name: string; type?: string; aliases?: string[]; description?: string };
type Relation = { source: string; predicate: string; target: string; confidence?: number };

export class GraphRagService {
  private static normalize(value: string): string { return value.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }

  public static async indexDocument(documentId: string): Promise<void> {
    if (!isGeminiConfigured()) return;
    const chunks = await DocumentChunk.find({ documentId }).lean();
    for (const chunk of chunks) {
      try {
        const model = getGeminiClient().getGenerativeModel({ model: ENV.GEMINI_TEXT_MODEL, generationConfig: { temperature: 0, responseMimeType: 'application/json' } });
        const prompt = `Extract a customer-support knowledge graph. Return JSON only: {"entities":[{"name":"","type":"product|service|plan|feature|policy|process|requirement|fee|duration|channel|organization","aliases":[],"description":""}],"relations":[{"source":"exact entity name","predicate":"short relationship","target":"exact entity name","confidence":0.0}]}. Only include facts explicitly supported by this text:\n${chunk.content}`;
        const parsed = JSON.parse((await model.generateContent(prompt)).response.text()) as { entities?: Entity[]; relations?: Relation[] };
        const map = new Map<string, Types.ObjectId>();
        for (const entity of (parsed.entities || []).slice(0, 20)) {
          const normalizedName = this.normalize(entity.name || ''); if (!normalizedName) continue;
          const source = { documentId: chunk.documentId, chunkId: chunk._id, pageNumber: chunk.pageNumber };
          const saved = await KnowledgeEntity.findOneAndUpdate({ normalizedName }, {
            $setOnInsert: { canonicalName: entity.name, normalizedName, type: entity.type || 'concept', extractionVersion: 'v1' },
            $set: { description: entity.description || '' }, $addToSet: { aliases: { $each: entity.aliases || [] }, sources: source },
          }, { upsert: true, new: true });
          map.set(normalizedName, saved._id as Types.ObjectId);
        }
        for (const relation of (parsed.relations || []).slice(0, 30)) {
          const sourceEntityId = map.get(this.normalize(relation.source || '')); const targetEntityId = map.get(this.normalize(relation.target || ''));
          if (!sourceEntityId || !targetEntityId || !relation.predicate) continue;
          const source = { documentId: chunk.documentId, chunkId: chunk._id, pageNumber: chunk.pageNumber };
          await KnowledgeRelation.findOneAndUpdate({ sourceEntityId, predicate: relation.predicate, targetEntityId }, {
            $set: { confidence: Math.max(0, Math.min(1, relation.confidence ?? 0.7)) }, $addToSet: { sources: source }, $setOnInsert: { extractionVersion: 'v1' },
          }, { upsert: true });
        }
      } catch (error) { console.warn(`Graph extraction skipped for chunk ${chunk._id}:`, error); }
    }
  }

  public static async retrieve(query: ExpandedQuery, maxHops = 2): Promise<Map<string, string[]>> {
    const needles = [...query.entities, ...query.keywords].map((x) => this.normalize(x)).filter((x) => x.length > 2).slice(0, 20);
    if (!needles.length) return new Map();
    const escaped = needles.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const entities = await KnowledgeEntity.find({ $or: escaped.flatMap((value) => [{ normalizedName: { $regex: value, $options: 'i' } }, { aliases: { $regex: value, $options: 'i' } }]) }).limit(12).lean();
    let frontier = entities.map((e) => e._id as Types.ObjectId); const visited = new Set(frontier.map(String)); const paths = new Map<string, string[]>();
    for (const e of entities) for (const s of e.sources || []) paths.set(String(s.chunkId), [e.canonicalName]);
    for (let hop = 0; hop < maxHops && frontier.length; hop++) {
      const relations = await KnowledgeRelation.find({ $or: [{ sourceEntityId: { $in: frontier } }, { targetEntityId: { $in: frontier } }] }).limit(50).lean();
      const ids = [...new Set(relations.flatMap((r) => [String(r.sourceEntityId), String(r.targetEntityId)]))];
      const names = new Map((await KnowledgeEntity.find({ _id: { $in: ids } }).select('_id canonicalName').lean()).map((e) => [String(e._id), e.canonicalName]));
      const next: Types.ObjectId[] = [];
      for (const r of relations) {
        const path = [names.get(String(r.sourceEntityId)) || '', r.predicate, names.get(String(r.targetEntityId)) || ''];
        for (const s of r.sources || []) paths.set(String(s.chunkId), path);
        for (const id of [r.sourceEntityId, r.targetEntityId]) if (!visited.has(String(id))) { visited.add(String(id)); next.push(id as Types.ObjectId); }
      }
      frontier = next;
    }
    return paths;
  }

  public static async deleteDocument(documentId: string): Promise<void> {
    await KnowledgeRelation.updateMany({}, { $pull: { sources: { documentId } } }); await KnowledgeEntity.updateMany({}, { $pull: { sources: { documentId } } });
    await KnowledgeRelation.deleteMany({ sources: { $size: 0 } }); await KnowledgeEntity.deleteMany({ sources: { $size: 0 } });
  }
}
