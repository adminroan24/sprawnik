import { z } from 'zod';
import * as sprawyDb from '../db/sprawy.js';
import { bladBrakZasobu } from '../middleware/errors.js';
import type { Sprawa } from '../db/sprawy.js';

/** Data dzienna w zapisie ISO — format wymuszany na wejściu, aby nie trafiał do bazy w innej postaci. */
export const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data musi mieć postać RRRR-MM-DD')
  .refine((wartosc) => !Number.isNaN(new Date(`${wartosc}T00:00:00.000Z`).getTime()), 'Data nie istnieje');

export const identyfikator = z.coerce.number().int().positive();

/** Tekst opcjonalny: pusty łańcuch zapisywany jest jako brak wartości, nie jako pusty napis. */
export const tekstOpcjonalny = z
  .string()
  .trim()
  .transform((wartosc) => (wartosc === '' ? null : wartosc))
  .nullable()
  .default(null);

/**
 * Zwraca sprawę, o ile należy do wskazanego użytkownika.
 *
 * Sprawa cudza zgłaszana jest jako nieistniejąca, a nie jako zabroniona —
 * odpowiedź nie ujawnia wtedy, że dany identyfikator jest w systemie zajęty.
 */
export async function sprawaUzytkownika(id: number, uzytkownikId: number): Promise<Sprawa> {
  const sprawa = await sprawyDb.znajdz(id);
  if (!sprawa || sprawa.uzytkownikId !== uzytkownikId) {
    throw bladBrakZasobu('Sprawa nie istnieje');
  }
  return sprawa;
}
