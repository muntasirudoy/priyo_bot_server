"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const Admin_js_1 = require("../../models/Admin.js");
const env_js_1 = require("../../config/env.js");
class AuthService {
    /**
     * Generates a signed JWT for an admin.
     */
    static generateToken(admin) {
        const payload = {
            adminId: admin._id.toString(),
            email: admin.email,
        };
        return jsonwebtoken_1.default.sign(payload, env_js_1.ENV.JWT_SECRET, { expiresIn: '7d' });
    }
    /**
     * Registers a new admin.
     */
    static async registerAdmin(name, email, password) {
        const existing = await Admin_js_1.Admin.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
            throw new Error('An administrator with this email already exists.');
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash(password, salt);
        const admin = await Admin_js_1.Admin.create({
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
    static async loginAdmin(email, password) {
        const admin = await Admin_js_1.Admin.findOne({ email: email.toLowerCase().trim() });
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
    static async seedDefaultAdmin() {
        const count = await Admin_js_1.Admin.countDocuments();
        if (count === 0) {
            console.log('👤 Seeding default admin account (admin@support.com)...');
            await this.registerAdmin('Support Administrator', 'admin@support.com', 'Admin123!');
            console.log('✅ Default admin created: admin@support.com / Admin123!');
        }
    }
}
exports.AuthService = AuthService;
