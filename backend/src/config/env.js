import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root or workspace root if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // fallback to current working directory .env

export const env = Object.freeze({
  PORT: parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/nexusflow',

  // MongoDB Time-Series Telemetry Schema Contract
  DB_NAME: process.env.DB_NAME || 'nexusflow',
  TELEMETRY_COLLECTION: process.env.TELEMETRY_COLLECTION || 'telemetry',
  TELEMETRY_TIME_FIELD: process.env.TELEMETRY_TIME_FIELD || 'timestamp',
  TELEMETRY_META_FIELD: process.env.TELEMETRY_META_FIELD || 'metadata',

  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',
});

export default env;
