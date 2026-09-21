import { Router } from 'express';
import { z } from 'zod';
import * as terminyDb from '../db/terminy.js';
import { dzisiaj, podsumowanie, terminyUzytkownika } from '../services/przeglad.js';
import { wymagaZalogowania, zalogowany } from '../middleware/uwierzytelnianie.js';
import { dataIso, identyfikator, sprawaUzytkownika } from './wspolne.js';
import { bladBrakZasobu } from '../middleware/errors.js';

export const terminyRouter = Router();

terminyRouter.use(wymagaZalogowania);

/** UC8 i UC9 — przegląd terminów wraz ze stanem ostrzegawczym. */
terminyRouter.get('/', async (req, res) => {
  const zapytanie = z
    .object({
      status: z.enum(['otwarty', 'wykonany', 'anulowany', 'wszystkie']).default('otwarty'),
      progOstrzegania: z.coerce.number().int().min(1).max(365).default(7),
    })
    .parse(req.query);

  const terminy = await terminyUzytkownika(
    zalogowany(req).id,
    zapytanie.status === 'wszystkie' ? null : zapytanie.status,
    zapytanie.progOstrzegania,
  );

  res.json({ terminy, podsumowanie: podsumowanie(terminy), dzien: dzisiaj() });
});

const zmianaStatusu = z.object({
  status: z.enum(['otwarty', 'wykonany', 'anulowany']),
  dataWykonania: dataIso.nullable().default(null),
});

/** Odnotowanie decyzji użytkownika: termin wykonany albo anulowany. */
terminyRouter.patch('/:id', async (req, res) => {
  const id = identyfikator.parse(req.params.id);
  const termin = await terminyDb.znajdz(id);
  if (!termin) throw bladBrakZasobu('Termin nie istnieje');
  await sprawaUzytkownika(termin.sprawaId, zalogowany(req).id);

  const dane = zmianaStatusu.parse(req.body);
  // Data wykonania nie jest wymagana od użytkownika — brak oznacza dzień dzisiejszy.
  const dataWykonania = dane.status === 'wykonany' ? (dane.dataWykonania ?? dzisiaj()) : null;

  res.json({ termin: await terminyDb.zmienStatus(id, dane.status, dataWykonania) });
});
