import { pool } from './pool.js';
import type { SposobLiczenia, ZdarzeniePoczatkowe } from '../services/terminy.js';

export type Regula = {
  id: number;
  nazwa: string;
  liczbaDni: number;
  sposobLiczenia: SposobLiczenia;
  zdarzeniePoczatkowe: ZdarzeniePoczatkowe;
  przesuwajDniWolne: boolean;
  opis: string | null;
  aktywna: boolean;
};

const KOLUMNY = `
  id,
  nazwa,
  liczba_dni AS "liczbaDni",
  sposob_liczenia AS "sposobLiczenia",
  zdarzenie_poczatkowe AS "zdarzeniePoczatkowe",
  przesuwaj_dni_wolne AS "przesuwajDniWolne",
  opis,
  aktywna
`;

export async function lista(tylkoAktywne = true): Promise<Regula[]> {
  const { rows } = await pool.query<Regula>(
    `SELECT ${KOLUMNY} FROM regula_terminu
      WHERE ($1::boolean IS NOT TRUE OR aktywna)
      ORDER BY nazwa`,
    [tylkoAktywne],
  );
  return rows;
}

export async function znajdz(id: number): Promise<Regula | null> {
  const { rows } = await pool.query<Regula>(
    `SELECT ${KOLUMNY} FROM regula_terminu WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function dodaj(dane: Omit<Regula, 'id' | 'aktywna'>): Promise<Regula> {
  const { rows } = await pool.query<Regula>(
    `INSERT INTO regula_terminu
       (nazwa, liczba_dni, sposob_liczenia, zdarzenie_poczatkowe, przesuwaj_dni_wolne, opis)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${KOLUMNY}`,
    [
      dane.nazwa,
      dane.liczbaDni,
      dane.sposobLiczenia,
      dane.zdarzeniePoczatkowe,
      dane.przesuwajDniWolne,
      dane.opis,
    ],
  );
  return rows[0]!;
}
