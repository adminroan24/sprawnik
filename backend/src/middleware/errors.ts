import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

/**
 * Błąd z ustalonym kodem odpowiedzi HTTP. Pozwala warstwie API odróżnić
 * sytuację przewidzianą (brak zasobu, brak uprawnień) od usterki, która
 * nie powinna trafić do użytkownika w postaci komunikatu wewnętrznego.
 */
export class BladZadania extends Error {
  constructor(
    readonly kod: number,
    komunikat: string,
  ) {
    super(komunikat);
    this.name = 'BladZadania';
  }
}

export const bladBrakZasobu = (co = 'Nie znaleziono zasobu') => new BladZadania(404, co);
export const bladWalidacji = (co: string) => new BladZadania(400, co);
export const bladUprawnien = (co = 'Brak uprawnień do tej operacji') => new BladZadania(403, co);

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Nie znaleziono zasobu' });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof BladZadania) {
    res.status(err.kod).json({ error: err.message });
    return;
  }

  // Niezgodność danych wejściowych ze schematem jest błędem żądania, nie serwera.
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Dane żądania są nieprawidłowe',
      szczegoly: err.issues.map((problem) => ({
        pole: problem.path.join('.'),
        komunikat: problem.message,
      })),
    });
    return;
  }

  // Naruszenie ograniczenia bazy oznacza, że dane przeszły walidację wejścia,
  // ale kłócą się z regułą spójności. Zwracany jest kod żądania, a nie serwera.
  if (typeof err === 'object' && err !== null && 'code' in err && err.code === '23514') {
    console.error('[ograniczenie]', err);
    res.status(400).json({ error: 'Dane naruszają ograniczenie spójności bazy' });
    return;
  }

  const komunikat = err instanceof Error ? err.message : 'Błąd serwera';
  console.error('[error]', komunikat);
  res.status(500).json({ error: 'Błąd serwera' });
}
