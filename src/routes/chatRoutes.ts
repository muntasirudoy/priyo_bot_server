import { Router } from 'express';
import { ChatController } from '../controllers/chatController.js';
import { chatRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/message', chatRateLimiter, ChatController.sendMessage);
router.get('/conversations/:sessionId', ChatController.getCustomerConversation);

export default router;
