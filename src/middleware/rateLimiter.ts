import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30; // 30 requests per minute

export function chatRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const identifier = (req.body?.sessionId as string) || req.ip || 'anonymous';
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
