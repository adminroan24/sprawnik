import { Router } from 'express';
import { z } from 'zod';
import * as db from '../db/kontakty.js';
import { wymagaAdministratora, wymagaZalogowania } from '../middleware/uwierzytelnianie.js';
import { identyfikator } from './wspolne.js';
import { bladBrakZasobu } from '../middleware/errors.js';

export const kontaktyRouter = Router();
kontaktyRouter.use(wymagaZalogowania);
const daneKontaktu = z.object({
  typ: z.enum(['osoba','firma','instytucja']), nazwa: z.string().trim().min(1).max(200),
  nip: z.string().trim().max(30).default(''), email: z.union([z.literal(''),z.email()]).default(''),
  telefon: z.string().trim().max(60).default(''), adres: z.string().trim().max(1000).default(''),
  adresEdoreczen: z.string().trim().max(200).default(''), skrzynkaEpuap: z.string().trim().max(200).default(''),
  osobaKontaktowa: z.string().trim().max(200).default(''), notatka: z.string().trim().max(2000).default(''),
  aktywny: z.boolean().default(true),
});
kontaktyRouter.get('/', async (req, res) => {
  const f = z.object({ szukaj: z.string().trim().max(200).default(''), archiwalne: z.enum(['true','false']).default('false') }).parse(req.query);
  res.json({ kontakty: await db.lista(f.szukaj, f.archiwalne === 'true') });
});
kontaktyRouter.get('/:id', async (req,res) => {
  const kontakt = await db.znajdz(identyfikator.parse(req.params.id));
  if (!kontakt) throw bladBrakZasobu('Kontakt nie istnieje');
  res.json({ kontakt });
});
kontaktyRouter.post('/', wymagaAdministratora, async (req,res) => res.status(201).json({ kontakt: await db.zapisz(null, daneKontaktu.parse(req.body)) }));
kontaktyRouter.patch('/:id', wymagaAdministratora, async (req,res) => res.json({ kontakt: await db.zapisz(identyfikator.parse(req.params.id), daneKontaktu.parse(req.body)) }));
kontaktyRouter.delete('/:id', wymagaAdministratora, async (req,res) => { await db.usun(identyfikator.parse(req.params.id)); res.json({ usunieto: true }); });
