"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chatController_js_1 = require("../controllers/chatController.js");
const rateLimiter_js_1 = require("../middleware/rateLimiter.js");
const router = (0, express_1.Router)();
router.post('/message', rateLimiter_js_1.chatRateLimiter, chatController_js_1.ChatController.sendMessage);
router.get('/conversations/:sessionId', chatController_js_1.ChatController.getCustomerConversation);
exports.default = router;
