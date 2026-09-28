"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_js_1 = require("./app.js");
const env_js_1 = require("./config/env.js");
const database_js_1 = require("./config/database.js");
const AuthService_js_1 = require("./services/auth/AuthService.js");
async function bootstrap() {
    try {
        console.log('⚡ Starting AI Customer Support Backend Server...');
        // 1. Connect to MongoDB (or memory server)
        await (0, database_js_1.connectDatabase)();
        // 2. Seed default admin
        await AuthService_js_1.AuthService.seedDefaultAdmin();
        // 3. Start listening
        const server = app_js_1.app.listen(env_js_1.ENV.PORT, () => {
            console.log(`🚀 Server running in ${env_js_1.ENV.NODE_ENV} mode on port ${env_js_1.ENV.PORT}`);
            console.log(`🔗 API Base: http://localhost:${env_js_1.ENV.PORT}/api`);
        });
        // Graceful shutdown
        const handleShutdown = async (signal) => {
            console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
            server.close(() => {
                console.log('HTTP server closed.');
                process.exit(0);
            });
        };
        process.on('SIGINT', () => handleShutdown('SIGINT'));
        process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}
bootstrap();
