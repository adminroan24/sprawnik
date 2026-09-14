import type { NextFunction, Request, Response } from 'express';

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Nie znaleziono zasobu' });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const message = err instanceof Error ? err.message : 'Błąd serwera';
  console.error('[error]', message);
  res.status(500).json({ error: 'Błąd serwera' });
}
