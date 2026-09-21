import { Router } from 'express';
import { z } from 'zod';
import { zaloguj } from '../services/uwierzytelnianie.js';
import { wymagaZalogowania, zalogowany } from '../middleware/uwierzytelnianie.js';

export const uwierzytelnianieRouter = Router();

const daneLogowania = z.object({
  email: z.string().trim().email('Wymagany poprawny adres e-mail'),
  haslo: z.string().min(1, 'Hasło jest wymagane'),
});

uwierzytelnianieRouter.post('/logowanie', async (req, res) => {
  const dane = daneLogowania.parse(req.body);
  const { uzytkownik, token } = await zaloguj(dane.email, dane.haslo);
  res.json({ token, uzytkownik });
});

/** Pozwala interfejsowi sprawdzić, czy zapamiętany token jest nadal ważny. */
uwierzytelnianieRouter.get('/ja', wymagaZalogowania, (req, res) => {
  res.json({ uzytkownik: zalogowany(req) });
});
