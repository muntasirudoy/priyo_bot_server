import { Router } from 'express';
import { DocumentController, upload } from '../controllers/documentController.js';
import { requireAdminAuth } from '../middleware/authMiddleware.js';

const router = Router();

// All document management routes require admin authentication
router.use(requireAdminAuth as any);

router.post('/', upload.single('file'), DocumentController.uploadDocument);
router.get('/', DocumentController.listDocuments);
router.get('/:id', DocumentController.getDocument);
router.delete('/:id', DocumentController.deleteDocument);

export default router;
