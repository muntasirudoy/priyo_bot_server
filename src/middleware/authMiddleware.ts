import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { TokenPayload } from '../services/auth/AuthService.js';
import { Admin } from '../models/Admin.js';

export interface AuthenticatedRequest extends Request {
  admin?: {
    id: string;
    email: string;
    name: string;
  };
}

export async function requireAdminAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as TokenPayload;
    const admin = await Admin.findById(decoded.adminId).select('_id name email');

    if (!admin) {
      res.status(401).json({
        success: false,
        message: 'Invalid token: Admin account not found.',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    req.admin = {
      id: admin._id.toString(),
      email: admin.email,
      name: admin.name,
    };

    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.',
      code: 'INVALID_TOKEN',
    });
  }
}
