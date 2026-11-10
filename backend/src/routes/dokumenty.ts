import { raw, Router } from 'express';
import { z } from 'zod';
import * as dokumentyDb from '../db/dokumenty.js';
import * as pismaDb from '../db/pisma.js';
import { wymagaZalogowania, zalogowany } from '../middleware/uwierzytelnianie.js';
import { BladZadania, bladBrakZasobu, bladWalidacji } from '../middleware/errors.js';
import { identyfikator, sprawaUzytkownika } from './wspolne.js';
import { LIMIT_PLIKU, odczytajPlik, zapiszDokument } from '../services/dokumenty.js';

export const dokumentyRouter = Router();

dokumentyRouter.get('/sprawy/:id/dokumenty', wymagaZalogowania, async (req, res) => {
  const id = identyfikator.parse(req.params.id);
  await sprawaUzytkownika(id, zalogowany(req).id);
  const filtr = z.object({
    szukaj: z.string().trim().min(1).max(255).optional(),
    pismoId: identyfikator.optional(),
  }).parse(req.query);
  res.json({ dokumenty: await dokumentyDb.lista(id, filtr) });
});

// Własność pisma sprawdzana przed odczytaniem treści żądania.
dokumentyRouter.post('/pisma/:id/dokumenty', wymagaZalogowania, async (req, _res, next) => {
  const pismo = await pismaDb.znajdz(identyfikator.parse(req.params.id));
  if (!pismo) throw bladBrakZasobu('Pismo nie istnieje');
  await sprawaUzytkownika(pismo.sprawaId, zalogowany(req).id);
  if (!req.is('application/octet-stream')) throw new BladZadania(415, 'Wymagana binarna treść pliku');
  next();
}, raw({ type: 'application/octet-stream', limit: LIMIT_PLIKU, inflate: false }), async (req, res) => {
  const nazwa = z.string().trim().min(1).max(255)
    .refine((value) => !/[\\/\x00-\x1f\x7f]/.test(value) && value !== '.' && value !== '..',
      'Nazwa pliku nie może zawierać ścieżki ani znaków sterujących').parse(req.query.nazwa);
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw bladWalidacji('Plik jest pusty');
  const dokument = await zapiszDokument(identyfikator.parse(req.params.id), zalogowany(req).id, nazwa, req.body);
  res.status(201).json({ dokument });
});

dokumentyRouter.get('/dokumenty/:id/plik', wymagaZalogowania, async (req, res) => {
  const dokument = await dokumentyDb.znajdzDlaUzytkownika(
    identyfikator.parse(req.params.id), zalogowany(req).id,
  );
  if (!dokument) throw bladBrakZasobu('Dokument nie istnieje');
  const plik = await odczytajPlik(dokument);
  res.attachment(dokument.nazwaOryginalna);
  res.set('Content-Type', 'application/octet-stream');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'no-store');
  res.send(plik);
});
