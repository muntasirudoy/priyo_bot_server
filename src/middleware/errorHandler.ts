import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(`💥 [Error] ${req.method} ${req.url}:`, err);

  const statusCode = err.statusCode || 500;
  const code = err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');
  const message =
    statusCode === 500
      ? 'An unexpected internal server error occurred. Please try again later.'
      : err.message || 'An error occurred processing your request.';

  res.status(statusCode).json({
    success: false,
    message,
    code,
  });
}
