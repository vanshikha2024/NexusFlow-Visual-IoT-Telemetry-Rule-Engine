import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/apiError.js';

const connectionStates = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

let listenersAttached = false;

/**
 * Returns current MongoDB connection status string.
 * @returns {'connected' | 'connecting' | 'disconnecting' | 'disconnected' | 'unknown'}
 */
export const getDatabaseStatus = () => {
  return connectionStates[mongoose.connection.readyState] || 'unknown';
};

/**
 * Checks whether the MongoDB connection is fully established.
 * @returns {boolean}
 */
export const isConnected = () => {
  return mongoose.connection.readyState === 1;
};

/**
 * Returns the active MongoDB database name.
 * @returns {string}
 */
export const getDatabaseName = () => {
  return mongoose.connection.name || 'nexusflow';
};

/**
 * Retrieves the underlying MongoDB database instance from Mongoose.
 * @throws {ApiError} If MongoDB is not connected
 * @returns {import('mongodb').Db}
 */
export const getDatabase = () => {
  if (!isConnected() || !mongoose.connection.db) {
    throw new ApiError(
      503,
      `Database service unavailable (current status: ${getDatabaseStatus()}).`
    );
  }
  return mongoose.connection.db;
};

/**
 * Retrieves a native MongoDB collection handle without creating/modifying it.
 * Respects teammate Rishi's database design and DDL scripts.
 *
 * @param {string} collectionName
 * @throws {ApiError} If MongoDB is not connected
 * @returns {import('mongodb').Collection}
 */
export const getCollection = (collectionName) => {
  const db = getDatabase();
  return db.collection(collectionName);
};

/**
 * Sets up MongoDB connection lifecycle event handlers once.
 */
const attachLifecycleListeners = () => {
  if (listenersAttached) return;

  mongoose.connection.on('connected', () => {
    logger.info(
      `MongoDB connected to database "${mongoose.connection.name}" at host: ${mongoose.connection.host}`
    );
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB connection lost / disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected successfully');
  });

  listenersAttached = true;
};

/**
 * Connects to MongoDB using the configured MONGODB_URI.
 * Safe for concurrent invocations and includes non-crashing fallback for development.
 *
 * @returns {Promise<typeof mongoose | null>}
 */
export const connectDB = async () => {
  // If already connected, return existing connection
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  attachLifecycleListeners();

  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    return conn;
  } catch (error) {
    logger.warn(
      `MongoDB initial connection failed (${error.message}). Continuing in fallback mode for development without crashing.`
    );
    return null;
  }
};

/**
 * Closes the MongoDB connection gracefully.
 * @returns {Promise<void>}
 */
export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB connection closed.');
  }
};

export default {
  connectDB,
  disconnectDB,
  getDatabaseStatus,
  isConnected,
  getDatabaseName,
  getDatabase,
  getCollection,
};
