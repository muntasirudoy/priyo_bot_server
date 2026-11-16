"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRateLimiter = chatRateLimiter;
const rateLimitMap = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30; // 30 requests per minute
const MAX_IP_REQUESTS = 120;
function consume(identifier, limit, now) {
    const record = rateLimitMap.get(identifier);
    if (!record || now > record.resetTime) {
        rateLimitMap.set(identifier, { count: 1, resetTime: now + WINDOW_MS });
        return true;
    }
    if (record.count >= limit)
        return false;
    record.count++;
    return true;
}
function chatRateLimiter(req, res, next) {
    const sessionId = req.body?.sessionId || 'anonymous';
    const ip = req.ip || 'unknown';
    const now = Date.now();
    if (!consume(`ip:${ip}`, MAX_IP_REQUESTS, now) || !consume(`session:${ip}:${sessionId}`, MAX_REQUESTS, now)) {
        res.status(429).json({
            success: false,
            message: 'Too many requests. Please wait a moment before sending another message.',
            code: 'RATE_LIMIT_EXCEEDED',
        });
        return;
    }
    next();
}
