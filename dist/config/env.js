"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
exports.ENV = {
    PORT: parseInt(process.env.PORT || '5000', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    MONGODB_URI: process.env.MONGODB_URI || '',
    JWT_SECRET: process.env.JWT_SECRET || 'ai-support-chatbot-secret-key-change-in-prod-12345',
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',
    GEMINI_TEXT_MODEL: process.env.GEMINI_TEXT_MODEL || 'gemini-1.5-flash',
    UPLOAD_DIR: path_1.default.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads'),
};
