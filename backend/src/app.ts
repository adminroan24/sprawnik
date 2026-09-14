import express from 'express';
import { healthRouter } from './routes/health.js';
import { errorHandler, notFound } from './middleware/errors.js';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use('/api', healthRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
