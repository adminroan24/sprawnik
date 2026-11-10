import { Router } from 'express';
import { z } from 'zod';
import { wymagaZalogowania, wymagaAdministratora, zalogowany } from '../middleware/uwierzytelnianie.js';
import { bladBrakZasobu } from '../middleware/errors.js';
import { identyfikator, sprawaUzytkownika } from './wspolne.js';
import { znajdz } from '../db/pisma.js';
import { listaSkanow, rozpoznajSkan, importujSkan } from '../services/skany.js';

export const skanyRouter = Router();
skanyRouter.use(wymagaZalogowania, wymagaAdministratora);
const idSkanu = z.string().min(1).max(2048);

skanyRouter.get('/', async (_req, res) => { res.json({ skany: await listaSkanow() }); });

skanyRouter.post('/:id/rozpoznaj', async (req, res) => {
  res.json(await rozpoznajSkan(idSkanu.parse(req.params.id), zalogowany(req).id));
});

skanyRouter.post('/:id/import', async (req, res) => {
  const dane = z.object({ pismoId: identyfikator,
    rola: z.enum(['tresc', 'zalacznik', 'dowod_nadania', 'potwierdzenie_odbioru']).default('tresc'),
    sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  }).parse(req.body);
  const pismo = await znajdz(dane.pismoId);
  if (!pismo) throw bladBrakZasobu('Pismo nie istnieje');
  await sprawaUzytkownika(pismo.sprawaId, zalogowany(req).id);
  res.status(201).json(await importujSkan(idSkanu.parse(req.params.id), zalogowany(req).id,
    dane.pismoId, dane.rola, dane.sha256));
});
