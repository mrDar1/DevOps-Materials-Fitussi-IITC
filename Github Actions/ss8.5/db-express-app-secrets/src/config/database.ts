import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from './logger.js';

/**
 * Connect to MongoDB. Pass an explicit uri to override the one built
 * from env (used by tests with an in-memory server).
 */
export const connectDatabase = async (uri: string = config.mongo.uri): Promise<void> => {
  console.log('Connecting to MongoDB...');
  console.log(`URI: ${uri}`);
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  logger.info(`MongoDB connected → ${config.mongo.host}/${config.mongo.db}`);
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
};

export { mongoose };
