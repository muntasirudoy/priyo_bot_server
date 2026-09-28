"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = connectDatabase;
exports.disconnectDatabase = disconnectDatabase;
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
const env_js_1 = require("./env.js");
let mongod = null;
async function connectDatabase() {
    try {
        let uri = env_js_1.ENV.MONGODB_URI;
        if (!uri) {
            console.log('ℹ️  No MONGODB_URI provided. Starting in-memory MongoDB server...');
            mongod = await mongodb_memory_server_1.MongoMemoryServer.create();
            uri = mongod.getUri();
            console.log(`✅ In-memory MongoDB started at: ${uri}`);
        }
        await mongoose_1.default.connect(uri);
        console.log(`🚀 Connected to MongoDB successfully (${mongoose_1.default.connection.host})`);
    }
    catch (err) {
        console.error('❌ MongoDB connection error:', err);
        if (!mongod && env_js_1.ENV.NODE_ENV !== 'production') {
            console.log('🔄 Attempting fallback to in-memory MongoDB...');
            mongod = await mongodb_memory_server_1.MongoMemoryServer.create();
            const uri = mongod.getUri();
            await mongoose_1.default.connect(uri);
            console.log(`✅ Fallback in-memory MongoDB connected at: ${uri}`);
        }
        else {
            throw err;
        }
    }
}
async function disconnectDatabase() {
    await mongoose_1.default.disconnect();
    if (mongod) {
        await mongod.stop();
    }
}
