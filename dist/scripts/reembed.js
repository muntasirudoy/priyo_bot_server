"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_js_1 = require("../config/database.js");
const PdfProcessor_js_1 = require("../services/documents/PdfProcessor.js");
const Document_js_1 = require("../models/Document.js");
const mongoose_1 = __importDefault(require("mongoose"));
async function main() {
    await (0, database_js_1.connectDatabase)();
    const docs = await Document_js_1.DocumentModel.find({});
    console.log(`Found ${docs.length} document(s) to reprocess.`);
    for (const doc of docs) {
        if (doc.fileUrl) {
            console.log(`Reprocessing document ${doc._id} (${doc.originalName})...`);
            await PdfProcessor_js_1.PdfProcessor.executeProcessing(doc._id.toString(), doc.fileUrl);
        }
    }
    console.log('Finished reprocessing all documents!');
    await mongoose_1.default.disconnect();
    process.exit(0);
}
main().catch((err) => {
    console.error('Reprocess failed:', err);
    process.exit(1);
});
