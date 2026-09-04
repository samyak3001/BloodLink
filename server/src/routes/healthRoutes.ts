import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  const dbReadyState = mongoose.connection.readyState;
  const isDbReady = dbReadyState === 1;

  res.status(isDbReady ? 200 : 503).json({
    status: isDbReady ? 'ok' : 'degraded',
    service: 'BloodLink API',
    database: {
      connected: isDbReady,
      readyState: dbReadyState, // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
      host: isDbReady ? mongoose.connection.host : null,
      name: isDbReady ? mongoose.connection.name : null,
    },
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    version: '1.0.0',
  });
});

export default router;
