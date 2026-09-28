"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRateLimiter = chatRateLimiter;
const rateLimitMap = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30; // 30 requests per minute
function chatRateLimiter(req, res, next) {
    const identifier = req.body?.sessionId || req.ip || 'anonymous';
    const now = Date.now();
    const record = rateLimitMap.get(identifier);
    if (!record || now > record.resetTime) {
        rateLimitMap.set(identifier, {
            count: 1,
            resetTime: now + WINDOW_MS,
        });
        return next();
    }
    if (record.count >= MAX_REQUESTS) {
        res.status(429).json({
            success: false,
            message: 'Too many requests. Please wait a moment before sending another message.',
            code: 'RATE_LIMIT_EXCEEDED',
        });
        return;
    }
    record.count++;
    next();
}
