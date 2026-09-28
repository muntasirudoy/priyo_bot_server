import { connectDatabase } from '../config/database.js';
import { PdfProcessor } from '../services/documents/PdfProcessor.js';
import { DocumentModel } from '../models/Document.js';
import mongoose from 'mongoose';

async function main() {
  await connectDatabase();
  const docs = await DocumentModel.find({});
  console.log(`Found ${docs.length} document(s) to reprocess.`);

  for (const doc of docs) {
    if (doc.fileUrl) {
      console.log(`Reprocessing document ${doc._id} (${doc.originalName})...`);
      await PdfProcessor.executeProcessing(doc._id.toString(), doc.fileUrl);
    }
  }

  console.log('Finished reprocessing all documents!');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Reprocess failed:', err);
  process.exit(1);
});
