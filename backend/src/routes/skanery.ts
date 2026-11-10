import { Router } from 'express';
import { z } from 'zod';
import { wymagaZalogowania, wymagaAdministratora, zalogowany } from '../middleware/uwierzytelnianie.js';
import { identyfikator, sprawaUzytkownika } from './wspolne.js';
import { bladBrakZasobu } from '../middleware/errors.js';
import * as pismaDb from '../db/pisma.js';
import { listaSkanerow, wykonajSkan, skanowanieWlaczone } from '../services/skanery.js';
import { zapiszDokument } from '../services/dokumenty.js';

export const skaneryRouter = Router();

skaneryRouter.get('/skanery', wymagaZalogowania, wymagaAdministratora, async (_req, res) => {
  res.json({ wlaczone: skanowanieWlaczone(), skanery: await listaSkanerow() });
});

skaneryRouter.post('/pisma/:id/skan', wymagaZalogowania, wymagaAdministratora, async (req, res) => {
  const id = identyfikator.parse(req.params.id);
  const pismo = await pismaDb.znajdz(id);
  if (!pismo) throw bladBrakZasobu('Pismo nie istnieje');
  await sprawaUzytkownika(pismo.sprawaId, zalogowany(req).id);
  const dane = z.object({
    urzadzenie: z.string().min(1).max(1024),
    dpi: z.union([z.literal(150), z.literal(200), z.literal(300)]).default(200),
    rola: z.enum(['tresc', 'zalacznik', 'dowod_nadania', 'potwierdzenie_odbioru']).default('tresc'),
  }).parse(req.body);
  const plik = await wykonajSkan(dane.urzadzenie, dane.dpi);
  const nazwa = `Skan-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
  res.status(201).json({ dokument: await zapiszDokument(id, zalogowany(req).id, nazwa, plik, dane.rola) });
});
