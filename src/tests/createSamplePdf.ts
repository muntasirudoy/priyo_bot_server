import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

/**
 * Creates a valid, standard multi-page customer service PDF using PDFKit.
 */
export async function generateSupportPolicyPdf(outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const parentDir = path.dirname(outputPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(outputPath);

    doc.pipe(writeStream);

    // Page 1: Shipping Policy
    doc.fontSize(22).font('Helvetica-Bold').text('NovaTech Customer Support Policy', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').fillColor('#64748b').text('Official Documentation - Version 2026.1', { align: 'center' });
    doc.moveDown(2);

    doc.fillColor('#0f172a');
    doc.fontSize(16).font('Helvetica-Bold').text('1. Shipping and Delivery Times');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica').text(
      'Orders placed Monday through Friday before 3:00 PM EST are processed within 1 to 2 business days. ' +
      'Standard domestic shipping takes 3 to 5 business days for delivery to all addresses within the continental United States. ' +
      'Express overnight shipping is available at checkout for an additional $15 flat rate. ' +
      'Tracking numbers are automatically generated and emailed to the customer as soon as the carrier scans the parcel.'
    );
    doc.moveDown(1.5);

    doc.fontSize(16).font('Helvetica-Bold').text('2. International Shipping & Customs');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica').text(
      'International shipments typically arrive within 7 to 14 business days depending on customs clearance. ' +
      'All applicable import duties and customs taxes are calculated at checkout and prepaid to avoid delivery delays.'
    );

    // Page 2: Return & Refund Policy
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('3. Return Window and Refund Policy');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica').text(
      'We offer a 30-day money-back guarantee on all NovaTech hardware products. ' +
      'To qualify for a full refund, items must be in their original condition and include all original packaging, cords, and documentation. ' +
      'Refunds are credited back to the customer’s original method of payment within 5 to 7 business days following warehouse inspection.'
    );
    doc.moveDown(1.5);

    doc.fontSize(16).font('Helvetica-Bold').text('4. Warranty & Defective Equipment');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica').text(
      'Every device comes with a 2-year comprehensive manufacturer limited warranty covering mechanical and hardware failures. ' +
      'If your device arrives damaged or fails within warranty, NovaTech will provide a complimentary prepaid return shipping label and ship an advanced replacement unit.'
    );

    doc.end();

    writeStream.on('finish', () => {
      console.log(`✅ Generated valid PDF document at: ${outputPath}`);
      resolve();
    });

    writeStream.on('error', reject);
  });
}

if (process.argv[1]?.includes('createSamplePdf')) {
  generateSupportPolicyPdf(path.resolve(process.cwd(), 'sample-support-policy.pdf')).catch(console.error);
}
