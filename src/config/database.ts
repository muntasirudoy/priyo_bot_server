import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ENV } from './env.js';

let mongod: MongoMemoryServer | null = null;

export async function connectDatabase(): Promise<void> {
  try {
    let uri = ENV.MONGODB_URI;

    if (!uri) {
      console.log('ℹ️  No MONGODB_URI provided. Starting in-memory MongoDB server...');
      mongod = await MongoMemoryServer.create();
      uri = mongod.getUri();
      console.log(`✅ In-memory MongoDB started at: ${uri}`);
    }

    await mongoose.connect(uri);
    console.log(`🚀 Connected to MongoDB successfully (${mongoose.connection.host})`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    if (!mongod && ENV.NODE_ENV !== 'production') {
      console.log('🔄 Attempting fallback to in-memory MongoDB...');
      mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      await mongoose.connect(uri);
      console.log(`✅ Fallback in-memory MongoDB connected at: ${uri}`);
    } else {
      throw err;
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
}
