"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotSettings = exports.DEFAULT_BOT_SETTINGS = void 0;
exports.getBotSettings = getBotSettings;
const mongoose_1 = __importStar(require("mongoose"));
exports.DEFAULT_BOT_SETTINGS = {
    botName: 'Support', tone: 'friendly', greetingMessage: 'Hi! How can I help you today?',
    fallbackMessage: 'Could you tell me a little more so I can help? I can also ask our support team to follow up by email.',
    confidenceThreshold: 0.65,
};
const schema = new mongoose_1.Schema({
    key: { type: String, unique: true, default: 'default' },
    botName: { type: String, default: exports.DEFAULT_BOT_SETTINGS.botName },
    tone: { type: String, enum: ['friendly', 'professional', 'casual'], default: 'friendly' },
    greetingMessage: { type: String, default: exports.DEFAULT_BOT_SETTINGS.greetingMessage },
    fallbackMessage: { type: String, default: exports.DEFAULT_BOT_SETTINGS.fallbackMessage },
    confidenceThreshold: { type: Number, min: 0, max: 1, default: 0.65 },
}, { timestamps: true });
exports.BotSettings = mongoose_1.default.model('BotSettings', schema);
async function getBotSettings() {
    return (await exports.BotSettings.findOne({ key: 'default' }).lean()) ?? exports.DEFAULT_BOT_SETTINGS;
}
