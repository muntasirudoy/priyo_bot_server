import { Router } from 'express';
import { ConversationController } from '../controllers/conversationController.js';
import { requireAdminAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAdminAuth as any);

router.get('/', ConversationController.listConversations);
router.get('/:id', ConversationController.getConversation);
router.patch('/:id/status', ConversationController.updateStatus);

export default router;
