import { Router } from 'express';
import { z } from 'zod';
import * as db from '../db/organizacja.js';
import { wymagaAdministratora, wymagaZalogowania } from '../middleware/uwierzytelnianie.js';
import { identyfikator } from './wspolne.js';
export const organizacjaRouter = Router();
organizacjaRouter.use(wymagaZalogowania);
organizacjaRouter.get('/firma', async (_req, res) => res.json({ firma: await db.profil() }));
organizacjaRouter.patch('/firma', wymagaAdministratora, async (req, res) => {
  const dane = z.object({ nazwa: z.string().trim().min(1).max(200), nip: z.string().trim().max(30).default(''),
    email: z.union([z.literal(''),z.email()]).default(''), telefon: z.string().trim().max(60).default(''),
    adres: z.string().trim().max(500).default(''), stronaWww: z.union([z.literal(''),z.url({ protocol: /^https?$/ })]).default(''),
  }).parse(req.body);
  res.json({ firma: await db.zapiszProfil(dane) });
});
organizacjaRouter.get('/grupy', async (_req, res) => res.json({ grupy: await db.grupy() }));
organizacjaRouter.post('/grupy/szablon-creationx', wymagaAdministratora, async (_req, res) => res.status(201).json({ grupy: await db.szablonCreationX() }));
const grupa = z.object({ nazwa: z.string().trim().min(1).max(150), rodzicId: identyfikator.nullable().default(null), kolejnosc: z.number().int().min(0).max(10000).default(0) });
organizacjaRouter.post('/grupy', wymagaAdministratora, async (req, res) => res.status(201).json({ grupa: await db.zapiszGrupe(null, grupa.parse(req.body)) }));
organizacjaRouter.patch('/grupy/:id', wymagaAdministratora, async (req, res) => res.json({ grupa: await db.zapiszGrupe(identyfikator.parse(req.params.id), grupa.parse(req.body)) }));
organizacjaRouter.delete('/grupy/:id', wymagaAdministratora, async (req, res) => {
  await db.usunGrupe(identyfikator.parse(req.params.id)); res.json({ usunieto: true });
});
