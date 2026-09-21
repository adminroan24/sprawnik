import { Router } from 'express';
import { z } from 'zod';
import * as regulyDb from '../db/reguly.js';
import { listaDniWolnych } from '../db/kalendarz.js';
import { wymagaAdministratora, wymagaZalogowania } from '../middleware/uwierzytelnianie.js';

export const regulyRouter = Router();

regulyRouter.use(wymagaZalogowania);

/** Reguły widoczne są dla każdego zalogowanego — bez nich nie da się zarejestrować pisma. */
regulyRouter.get('/', async (req, res) => {
  const { wszystkie } = z.object({ wszystkie: z.coerce.boolean().default(false) }).parse(req.query);
  res.json({ reguly: await regulyDb.lista(!wszystkie) });
});

const nowaRegula = z.object({
  nazwa: z.string().trim().min(1, 'Nazwa reguły jest wymagana'),
  liczbaDni: z.number().int().positive('Reguła musi wyznaczać dodatnią liczbę dni'),
  sposobLiczenia: z.enum(['dni_kalendarzowe', 'dni_robocze']),
  zdarzeniePoczatkowe: z.enum(['doreczenie', 'nadanie']).default('doreczenie'),
  przesuwajDniWolne: z.boolean().default(true),
  opis: z.string().trim().nullable().default(null),
});

/** UC6 — definiowanie reguły terminu. Operacja konfiguracyjna, zastrzeżona dla administratora. */
regulyRouter.post('/', wymagaAdministratora, async (req, res) => {
  const dane = nowaRegula.parse(req.body);
  res.status(201).json({ regula: await regulyDb.dodaj(dane) });
});

/** Kalendarz dni wolnych — pozwala sprawdzić, dlaczego termin został przesunięty. */
regulyRouter.get('/dni-wolne', async (req, res) => {
  const { rok } = z
    .object({ rok: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()) })
    .parse(req.query);
  res.json({ rok, dniWolne: await listaDniWolnych(rok) });
});
