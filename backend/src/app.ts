import express from 'express';
import { z } from 'zod';
import { pl } from 'zod/locales';
import { healthRouter } from './routes/health.js';
import { uwierzytelnianieRouter } from './routes/uwierzytelnianie.js';
import { sprawyRouter } from './routes/sprawy.js';
import { pismaRouter } from './routes/pisma.js';
import { terminyRouter } from './routes/terminy.js';
import { regulyRouter } from './routes/reguly.js';
import { errorHandler, notFound } from './middleware/errors.js';

// Komunikaty walidacji w języku interfejsu — domyślne są angielskie i trafiłyby
// wprost do użytkownika, bo API zwraca je razem z nazwą pola.
z.config(pl());

export function createApp() {
  const app = express();

  app.use(express.json());

  // Podział tras odpowiada warstwom z diagramu komponentów: trasy przyjmują
  // żądanie i walidują wejście, obsługę merytoryczną zlecają warstwie dziedzinowej.
  app.use('/api', healthRouter);
  app.use('/api', uwierzytelnianieRouter);
  app.use('/api/sprawy', sprawyRouter);
  app.use('/api/pisma', pismaRouter);
  app.use('/api/terminy', terminyRouter);
  app.use('/api/reguly', regulyRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
