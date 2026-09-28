"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const env_js_1 = require("./config/env.js");
const errorHandler_js_1 = require("./middleware/errorHandler.js");
// Route imports
const authRoutes_js_1 = __importDefault(require("./routes/authRoutes.js"));
const documentRoutes_js_1 = __importDefault(require("./routes/documentRoutes.js"));
const chatRoutes_js_1 = __importDefault(require("./routes/chatRoutes.js"));
const conversationRoutes_js_1 = __importDefault(require("./routes/conversationRoutes.js"));
const adminRoutes_js_1 = __importDefault(require("./routes/adminRoutes.js"));
exports.app = (0, express_1.default)();
// Security and utility middleware
exports.app.use((0, cors_1.default)({
    origin: [env_js_1.ENV.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
}));
exports.app.use(express_1.default.json({ limit: '10mb' }));
exports.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Health check endpoint
exports.app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'ai-customer-support-server',
    });
});
// Mount modular API routes
exports.app.use('/api/auth', authRoutes_js_1.default);
exports.app.use('/api/documents', documentRoutes_js_1.default);
exports.app.use('/api/chat', chatRoutes_js_1.default);
exports.app.use('/api/conversations', conversationRoutes_js_1.default);
exports.app.use('/api/admin', adminRoutes_js_1.default);
// 404 handler for undefined routes
exports.app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Endpoint ${req.originalUrl} not found.`,
        code: 'ROUTE_NOT_FOUND',
    });
});
// Centralized error handler
exports.app.use(errorHandler_js_1.errorHandler);
