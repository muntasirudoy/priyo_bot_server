import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { requireAdminAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/me', requireAdminAuth as any, AuthController.getMe as any);

export default router;
