"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const AuthService_js_1 = require("../services/auth/AuthService.js");
class AuthController {
    static async register(req, res, next) {
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
            const { admin, token } = await AuthService_js_1.AuthService.registerAdmin(name, email, password);
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
        }
        catch (err) {
            next(err);
        }
    }
    static async login(req, res, next) {
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
            const { admin, token } = await AuthService_js_1.AuthService.loginAdmin(email, password);
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
        }
        catch (err) {
            res.status(401).json({
                success: false,
                message: err.message || 'Invalid email or password.',
                code: 'INVALID_CREDENTIALS',
            });
        }
    }
    static async getMe(req, res) {
        res.json({
            success: true,
            data: {
                admin: req.admin,
            },
        });
    }
}
exports.AuthController = AuthController;
