import { Router } from 'express';
import { checkConnection } from '../db/pool.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const database = await checkConnection();
  res.status(database ? 200 : 503).json({
    status: database ? 'ok' : 'degraded',
    database: database ? 'up' : 'down',
    timestamp: new Date().toISOString(),
  });
});
