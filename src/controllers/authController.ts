import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth/AuthService.js';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';

export class AuthController {
  public static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        res.status(400).json({
          success: false,
          message: 'Name, email, and password are required.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long.',
          code: 'WEAK_PASSWORD',
        });
        return;
      }

      const { admin, token } = await AuthService.registerAdmin(name, email, password);

      res.status(201).json({
        success: true,
        data: {
          admin: {
            id: admin._id,
            name: admin.name,
            email: admin.email,
          },
          token,
        },
      });
    } catch (err: any) {
      next(err);
    }
  }

  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const { admin, token } = await AuthService.loginAdmin(email, password);

      res.json({
        success: true,
        data: {
          admin: {
            id: admin._id,
            name: admin.name,
            email: admin.email,
          },
          token,
        },
      });
    } catch (err: any) {
      res.status(401).json({
        success: false,
        message: err.message || 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS',
      });
    }
  }

  public static async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        admin: req.admin,
      },
    });
  }
}
