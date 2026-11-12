import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const connectionStates = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/**
 * Returns current MongoDB connection status.
 */
export const getDatabaseStatus = () => {
  return connectionStates[mongoose.connection.readyState] || 'unknown';
};

/**
 * Basic MongoDB connection configuration.
 * Connects to MongoDB without defining models/schemas, leaving database
 * schema design entirely to teammate Rishi's specifications.
 */
export const connectDB = async () => {
  try {
    mongoose.connection.on('connected', () => {
      logger.info(`MongoDB connected: ${mongoose.connection.host}`);
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    return conn;
  } catch (error) {
    logger.warn(
      `MongoDB connection failed (${error.message}). Continuing in fallback mode for development without crashing.`
    );
    return null;
  }
};

/**
 * Closes the MongoDB connection gracefully.
 */
export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB connection closed.');
  }
};
