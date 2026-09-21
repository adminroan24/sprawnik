import { Router } from 'express';
import { z } from 'zod';
import * as pismaDb from '../db/pisma.js';
import { uzupelnijDoreczenie } from '../services/rejestracja.js';
import { wymagaZalogowania, zalogowany } from '../middleware/uwierzytelnianie.js';
import { dataIso, identyfikator, sprawaUzytkownika, tekstOpcjonalny } from './wspolne.js';
import { bladBrakZasobu } from '../middleware/errors.js';

export const pismaRouter = Router();

pismaRouter.use(wymagaZalogowania);

const potwierdzenieDoreczenia = z.object({
  dataDoreczenia: dataIso,
  regulaId: identyfikator.nullable().default(null),
  czynnosc: tekstOpcjonalny,
});

/**
 * Potwierdzenie doręczenia pisma zarejestrowanego wcześniej. Regułę wskazuje się
 * ponownie w tym miejscu, ponieważ pismo bez daty doręczenia nie przechowuje
 * terminu ani podstawy, z której miałby powstać.
 */
pismaRouter.patch('/:id/doreczenie', async (req, res) => {
  const id = identyfikator.parse(req.params.id);
  const pismo = await pismaDb.znajdz(id);
  if (!pismo) throw bladBrakZasobu('Pismo nie istnieje');
  await sprawaUzytkownika(pismo.sprawaId, zalogowany(req).id);

  const dane = potwierdzenieDoreczenia.parse(req.body);
  res.json(await uzupelnijDoreczenie(id, dane.dataDoreczenia, dane.regulaId, dane.czynnosc));
});
