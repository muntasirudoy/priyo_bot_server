import { Router } from 'express';
import { AdminController } from '../controllers/adminController.js';
import { requireAdminAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAdminAuth as any);

router.get('/dashboard', AdminController.getDashboardStats);
router.get('/settings', AdminController.getSettings);
router.put('/settings', AdminController.updateSettings);
router.get('/knowledge-gaps', AdminController.getKnowledgeGaps);
router.patch('/knowledge-gaps/:id/resolve', AdminController.resolveKnowledgeGap);

export default router;
