import mongoose, { Schema, Document as MongooseDoc } from 'mongoose';
import { BotSettingsData } from '../types/index.js';

export interface IBotSettings extends MongooseDoc, BotSettingsData { key: string; }
export const DEFAULT_BOT_SETTINGS: BotSettingsData = {
  botName: 'Support', tone: 'friendly', greetingMessage: 'Hi! How can I help you today?',
  fallbackMessage: 'Could you tell me a little more so I can help? I can also ask our support team to follow up by email.',
  confidenceThreshold: 0.65,
};
const schema = new Schema<IBotSettings>({
  key: { type: String, unique: true, default: 'default' },
  botName: { type: String, default: DEFAULT_BOT_SETTINGS.botName },
  tone: { type: String, enum: ['friendly', 'professional', 'casual'], default: 'friendly' },
  greetingMessage: { type: String, default: DEFAULT_BOT_SETTINGS.greetingMessage },
  fallbackMessage: { type: String, default: DEFAULT_BOT_SETTINGS.fallbackMessage },
  confidenceThreshold: { type: Number, min: 0, max: 1, default: 0.65 },
}, { timestamps: true });
export const BotSettings = mongoose.model<IBotSettings>('BotSettings', schema);
export async function getBotSettings(): Promise<BotSettingsData> {
  return (await BotSettings.findOne({ key: 'default' }).lean()) ?? DEFAULT_BOT_SETTINGS;
}
