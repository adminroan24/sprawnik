import { Router } from 'express';
import { z } from 'zod';
import { wymagaZalogowania, wymagaAdministratora, zalogowany } from '../middleware/uwierzytelnianie.js';
import { bladBrakZasobu, bladWalidacji } from '../middleware/errors.js';
import { dataIso, identyfikator, sprawaUzytkownika } from './wspolne.js';
import { znajdz } from '../db/pisma.js';
import { listaSkanow, rozpoznajSkan, importujSkan, usunSkan, zapiszDateWplywu, terminOdpowiedziSkanu } from '../services/skany.js';
import { ustawieniaTerminu } from '../services/termin-odpowiedzi.js';

export const skanyRouter = Router();
skanyRouter.use(wymagaZalogowania, wymagaAdministratora);
const idSkanu = z.string().min(1).max(2048);

skanyRouter.get('/', async (_req, res) => { res.json({ skany: await listaSkanow(), obslugaAutomatyczna: process.env.SCAN_WATCH_ENABLED === 'true' }); });

skanyRouter.patch('/:id/wplyw', async (req, res) => {
  const dane = z.object({
    dataWplywu: dataIso.refine(data => {
      const dzien = new Date(`${data}T00:00:00.000Z`);
      return !Number.isNaN(dzien.getTime()) && dzien.toISOString().slice(0, 10) === data;
    }, 'Podaj istniejącą datę'),
    sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  }).parse(req.body);
  res.json(await zapiszDateWplywu(idSkanu.parse(req.params.id), dane.dataWplywu, zalogowany(req).id, dane.sha256));
});

skanyRouter.get('/:id/rozpoznanie', async (req, res) => {
  res.json({ rozpoznanie: await rozpoznajSkan(idSkanu.parse(req.params.id), zalogowany(req).id, false) });
});

skanyRouter.post('/:id/rozpoznaj', async (req, res) => {
  res.json(await rozpoznajSkan(idSkanu.parse(req.params.id), zalogowany(req).id));
});

skanyRouter.post('/:id/termin-odpowiedzi/podglad', async (req, res) => {
  const dane = ustawieniaTerminu.parse(req.body);
  res.json(await terminOdpowiedziSkanu(idSkanu.parse(req.params.id), dane, false, zalogowany(req).id));
});

skanyRouter.patch('/:id/termin-odpowiedzi', async (req, res) => {
  const dane = z.object({ termin: ustawieniaTerminu, potwierdzono: z.literal(true) }).parse(req.body);
  res.json(await terminOdpowiedziSkanu(idSkanu.parse(req.params.id), dane.termin, true, zalogowany(req).id));
});

skanyRouter.post('/:id/kosz', async (req, res) => {
  const dane = z.object({ powod: z.string().trim().max(500).default('') }).parse(req.body);
  res.json(await usunSkan(idSkanu.parse(req.params.id), zalogowany(req).id, dane.powod));
});

skanyRouter.post('/:id/import', async (req, res) => {
  const dane = z.object({ pismoId: identyfikator,
    rola: z.enum(['tresc', 'zalacznik', 'dowod_nadania', 'potwierdzenie_odbioru']).default('tresc'),
    sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  }).parse(req.body);
  const pismo = await znajdz(dane.pismoId);
  if (!pismo) throw bladBrakZasobu('Pismo nie istnieje');
  await sprawaUzytkownika(pismo.sprawaId, zalogowany(req).id);
  if (dane.rola === 'tresc' && pismo.kierunek === 'przychodzace' && !pismo.dataDoreczenia) {
    throw bladWalidacji('Przed dodaniem treści pisma przychodzącego uzupełnij datę wpływu / doręczenia');
  }
  res.status(201).json(await importujSkan(idSkanu.parse(req.params.id), zalogowany(req).id,
    dane.pismoId, dane.rola, dane.sha256));
});
