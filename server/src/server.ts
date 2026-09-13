import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import healthRoutes from './routes/healthRoutes';
import authRoutes from './routes/authRoutes';
import requestRoutes from './routes/requestRoutes';
import donorRoutes from './routes/donorRoutes';
import hospitalRoutes from './routes/hospitalRoutes';
import adminRoutes from './routes/adminRoutes';
import notificationRoutes from './routes/notificationRoutes';
import userRoutes from './routes/userRoutes';
import { connectDB } from './config/database';
import { initSocketIO } from './services/socketService';
import { ensureDemoUsers } from './scripts/seed';
import { sanitizeIncompatibleMatches } from './services/matchingService';

// Ensure .env is loaded from either server directory or workspace root
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const rawClientUrl = (process.env.CLIENT_URL || '').trim();
const normalizedClientUrl = rawClientUrl ? rawClientUrl.replace(/\/+$/, '') : null;

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: [
          "'self'",
          ...(normalizedClientUrl ? [normalizedClientUrl] : []),
          'https://bloodlink-frontend-gaqx.onrender.com',
          'http://localhost:5000',
          'ws://localhost:5000',
        ],
        fontSrc: ["'self'", 'https:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Strict CORS Configuration
const allowedOrigins = Array.from(
  new Set(
    [
      normalizedClientUrl,
      'https://bloodlink-frontend-gaqx.onrender.com',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ].filter((url): url is string => Boolean(url))
  )
);

const corsOptions: cors.CorsOptions = {
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health Check Routes
app.use('/', healthRoutes);
app.use('/api', healthRoutes);

// Authentication Routes
app.use('/api/auth', authRoutes);

// Emergency Request Routes
app.use('/api/requests', requestRoutes);

// Donor Routes
app.use('/api/donors', donorRoutes);

// Hospital Routes
app.use('/api/hospitals', hospitalRoutes);

// Admin Routes
app.use('/api/admin', adminRoutes);

// Notification Routes
app.use('/api/notifications', notificationRoutes);

// User Settings & Privacy Routes
app.use('/api/users', userRoutes);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handling Middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const isProd = process.env.NODE_ENV === 'production';
  console.error('[BloodLink Error]', err.name, err.message);

  if (err.message.includes('CORS')) {
    res.status(403).json({
      status: 'error',
      message: 'CORS access forbidden',
    });
    return;
  }

  // Handle Mongoose disconnection, buffering, and server selection errors cleanly
  if (
    err.name === 'MongooseError' ||
    err.name === 'MongoServerSelectionError' ||
    err.name === 'MongoNetworkError' ||
    err.message.includes('buffering timed out') ||
    err.message.includes('ECONNREFUSED')
  ) {
    res.status(503).json({
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database service is currently unreachable. Please ensure MongoDB is running and MONGODB_URI is valid.',
    });
    return;
  }

  res.status(500).json({
    status: 'error',
    message: isProd ? 'Internal server error' : err.message,
  });
});

// Create HTTP server wrapping Express app
const httpServer = createServer(app);

// Start Server & Connect Database
if (process.env.NODE_ENV !== 'test') {
  // Initialize Socket.IO on the HTTP server
  initSocketIO(httpServer);

  httpServer.listen(PORT, async () => {
    console.log(`[BloodLink Server] Running on http://localhost:${PORT}`);
    console.log(`[BloodLink Server] WebSocket available at ws://localhost:${PORT}`);
    console.log(`[BloodLink Server] Health check available at http://localhost:${PORT}/api/health`);
    try {
      await connectDB();
      const shouldSeedDemoUsers =
        process.env.NODE_ENV !== 'production' || process.env.SEED_DEMO_USERS === 'true';

      if (shouldSeedDemoUsers) {
        await ensureDemoUsers();
      }

      if (process.env.NODE_ENV !== 'production') {
        await sanitizeIncompatibleMatches();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('-----------------------------------------------------------');
      console.warn('[BloodLink Server WARNING] MongoDB is not currently reachable:');
      console.warn(`  ${msg}`);
      console.warn('  Ensure your MongoDB instance is running (e.g., local service, Docker,');
      console.warn('  or MongoDB Atlas URI configured in MONGODB_URI).');
      console.warn('  Endpoints requiring database access will return 503 (Database Unavailable).');
      console.warn('-----------------------------------------------------------');
    }
  });
}

export { httpServer };
export default app;
