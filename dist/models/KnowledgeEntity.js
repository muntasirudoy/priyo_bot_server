"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeEntity = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SourceSchema = new mongoose_1.Schema({
    documentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Document', required: true },
    chunkId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'DocumentChunk', required: true },
    pageNumber: { type: Number, required: true },
}, { _id: false });
const KnowledgeEntitySchema = new mongoose_1.Schema({
    canonicalName: { type: String, required: true },
    normalizedName: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true },
    aliases: { type: [String], default: [] },
    description: { type: String, default: '' },
    sources: { type: [SourceSchema], default: [] },
    extractionVersion: { type: String, required: true, default: 'v1' },
}, { timestamps: true });
KnowledgeEntitySchema.index({ canonicalName: 'text', aliases: 'text', description: 'text' });
exports.KnowledgeEntity = mongoose_1.default.model('KnowledgeEntity', KnowledgeEntitySchema);
