import { Router } from 'express';
import { AdminController } from '../controllers/adminController.js';
import { requireAdminAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAdminAuth as any);

router.get('/dashboard', AdminController.getDashboardStats);

export default router;
