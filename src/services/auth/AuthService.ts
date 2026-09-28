import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Admin, IAdmin } from '../../models/Admin.js';
import { ENV } from '../../config/env.js';

export interface TokenPayload {
  adminId: string;
  email: string;
}

export class AuthService {
  /**
   * Generates a signed JWT for an admin.
   */
  public static generateToken(admin: IAdmin): string {
    const payload: TokenPayload = {
      adminId: admin._id.toString(),
      email: admin.email,
    };

    return jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: '7d' });
  }

  /**
   * Registers a new admin.
   */
  public static async registerAdmin(name: string, email: string, password: string):Promise<{ admin: IAdmin; token: string }> {
    const existing = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      throw new Error('An administrator with this email already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const admin = await Admin.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
    });

    const token = this.generateToken(admin);
    return { admin, token };
  }

  /**
   * Authenticates an admin by email and password.
   */
  public static async loginAdmin(email: string, password: string): Promise<{ admin: IAdmin; token: string }> {
    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin) {
      throw new Error('Invalid email or password.');
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      throw new Error('Invalid email or password.');
    }

    const token = this.generateToken(admin);
    return { admin, token };
  }

  /**
   * Automatically seeds a default admin account if no admins exist.
   */
  public static async seedDefaultAdmin(): Promise<void> {
    const count = await Admin.countDocuments();
    if (count === 0) {
      console.log('👤 Seeding default admin account (admin@support.com)...');
      await this.registerAdmin('Support Administrator', 'admin@support.com', 'Admin123!');
      console.log('✅ Default admin created: admin@support.com / Admin123!');
    }
  }
}
