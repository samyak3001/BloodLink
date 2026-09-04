import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DEFAULT_MONGODB_URI = 'mongodb://localhost:27017/bloodlink';

/**
 * Connect to real MongoDB instance (Docker container or MongoDB Atlas)
 */
export async function connectDB(uri?: string): Promise<typeof mongoose> {
  const mongoURI = uri || process.env.MONGODB_URI || DEFAULT_MONGODB_URI;

  // Prevent multiple connection attempts if already connected
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  // Disable operation buffering so queries fail immediately with clear error
  // instead of hanging/buffering for 10000ms when database is unreachable.
  mongoose.set('bufferCommands', false);

  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`[Database] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[Database] MongoDB connection failed for ${mongoURI.replace(/:([^:@]+)@/, ':****@')}:`, error);
    throw error;
  }
}

/**
 * Disconnect cleanly from MongoDB
 */
export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[Database] MongoDB disconnected cleanly.');
  }
}

/**
 * Check if the database is currently connected
 */
export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

// Connection event listeners
mongoose.connection.on('connected', () => {
  console.log('[Database Event] Mongoose connection open.');
});

mongoose.connection.on('error', (err) => {
  console.error('[Database Event] Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('[Database Event] Mongoose connection disconnected.');
});
