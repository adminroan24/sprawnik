import { Router } from 'express';
import { z } from 'zod';
import * as sprawyDb from '../db/sprawy.js';
import * as pismaDb from '../db/pisma.js';
import { zarejestrujPismo, dodajTerminReczny } from '../services/rejestracja.js';
import { terminySprawy } from '../services/przeglad.js';
import { wymagaZalogowania, zalogowany } from '../middleware/uwierzytelnianie.js';
import { dataIso, identyfikator, sprawaUzytkownika, tekstOpcjonalny } from './wspolne.js';

export const sprawyRouter = Router();

sprawyRouter.use(wymagaZalogowania);

const noweDaneSprawy = z.object({
  tytul: z.string().trim().min(1, 'Tytuł sprawy jest wymagany'),
  znakWlasny: tekstOpcjonalny,
  organ: tekstOpcjonalny,
  dataWszczecia: dataIso.nullable().default(null),
  opis: tekstOpcjonalny,
});

const zmianaSprawy = z.object({
  tytul: z.string().trim().min(1).optional(),
  znakWlasny: tekstOpcjonalny.optional(),
  organ: tekstOpcjonalny.optional(),
  status: z.enum(['w_toku', 'zawieszona', 'zakonczona']).optional(),
  dataWszczecia: dataIso.nullable().optional(),
  opis: tekstOpcjonalny.optional(),
});

const nowePismo = z.object({
  kierunek: z.enum(['przychodzace', 'wychodzace']),
  rodzaj: z.string().trim().min(1, 'Rodzaj pisma jest wymagany'),
  korespondent: z.string().trim().min(1, 'Nadawca lub adresat jest wymagany'),
  znakPisma: tekstOpcjonalny,
  dataNadania: dataIso.nullable().default(null),
  dataDoreczenia: dataIso.nullable().default(null),
  opis: tekstOpcjonalny,
  regulaId: identyfikator.nullable().default(null),
  czynnosc: tekstOpcjonalny,
});

const recznyTermin = z.object({
  czynnosc: z.string().trim().min(1, 'Nazwa czynności jest wymagana'),
  dataPoczatkowa: dataIso,
  dataUplywu: dataIso,
  pismoId: identyfikator.nullable().default(null),
});

/** UC10 — wyszukiwanie i filtrowanie spraw. */
sprawyRouter.get('/', async (req, res) => {
  const filtr = z
    .object({
      szukaj: z.string().trim().min(1).optional(),
      status: z.enum(['w_toku', 'zawieszona', 'zakonczona']).optional(),
    })
    .parse(req.query);

  res.json({ sprawy: await sprawyDb.lista(zalogowany(req).id, filtr) });
});

/** UC1 — rejestracja sprawy. */
sprawyRouter.post('/', async (req, res) => {
  const dane = noweDaneSprawy.parse(req.body);
  const sprawa = await sprawyDb.dodaj({ uzytkownikId: zalogowany(req).id, ...dane });
  res.status(201).json({ sprawa });
});

/** UC2 i UC11 — sprawa wraz z korespondencją, terminami i chronologią. */
sprawyRouter.get('/:id', async (req, res) => {
  const id = identyfikator.parse(req.params.id);
  const sprawa = await sprawaUzytkownika(id, zalogowany(req).id);

  const [pisma, terminy, chronologia] = await Promise.all([
    pismaDb.listaDlaSprawy(id),
    terminySprawy(id),
    sprawyDb.chronologia(id),
  ]);

  res.json({ sprawa, pisma, terminy, chronologia });
});

sprawyRouter.patch('/:id', async (req, res) => {
  const id = identyfikator.parse(req.params.id);
  await sprawaUzytkownika(id, zalogowany(req).id);
  const zmiany = zmianaSprawy.parse(req.body);
  res.json({ sprawa: await sprawyDb.aktualizuj(id, zmiany) });
});

/** UC3 i UC4 — rejestracja pisma; termin powstaje w tej samej operacji (UC7). */
sprawyRouter.post('/:id/pisma', async (req, res) => {
  const id = identyfikator.parse(req.params.id);
  await sprawaUzytkownika(id, zalogowany(req).id);
  const dane = nowePismo.parse(req.body);
  res.status(201).json(await zarejestrujPismo(id, dane));
});

/** Termin dla czynności, dla której nie ma reguły — wprowadzany ręcznie. */
sprawyRouter.post('/:id/terminy', async (req, res) => {
  const id = identyfikator.parse(req.params.id);
  await sprawaUzytkownika(id, zalogowany(req).id);
  const dane = recznyTermin.parse(req.body);
  res.status(201).json({ termin: await dodajTerminReczny({ sprawaId: id, ...dane }) });
});
