"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminAuth = requireAdminAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_js_1 = require("../config/env.js");
const Admin_js_1 = require("../models/Admin.js");
async function requireAdminAuth(req, res, next) {
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
        const decoded = jsonwebtoken_1.default.verify(token, env_js_1.ENV.JWT_SECRET);
        const admin = await Admin_js_1.Admin.findById(decoded.adminId).select('_id name email');
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
    }
    catch (err) {
        res.status(401).json({
            success: false,
            message: 'Invalid or expired authentication token.',
            code: 'INVALID_TOKEN',
        });
    }
}
