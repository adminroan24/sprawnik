import { pool } from './pool.js';

export type KierunekPisma = 'przychodzace' | 'wychodzace';

export type Pismo = {
  id: number;
  sprawaId: number;
  kierunek: KierunekPisma;
  rodzaj: string;
  korespondent: string;
  znakPisma: string | null;
  dataNadania: string | null;
  dataDoreczenia: string | null;
  opis: string | null;
  utworzono: string;
};

const kolumny = (prefiks = '') => `
  ${prefiks}id,
  ${prefiks}sprawa_id       AS "sprawaId",
  ${prefiks}kierunek,
  ${prefiks}rodzaj,
  ${prefiks}korespondent,
  ${prefiks}znak_pisma      AS "znakPisma",
  ${prefiks}data_nadania    AS "dataNadania",
  ${prefiks}data_doreczenia AS "dataDoreczenia",
  ${prefiks}opis,
  ${prefiks}utworzono
`;

export async function listaDlaSprawy(sprawaId: number): Promise<Pismo[]> {
  const { rows } = await pool.query<Pismo>(
    `SELECT ${kolumny()} FROM pismo
      WHERE sprawa_id = $1
      ORDER BY coalesce(data_doreczenia, data_nadania, utworzono::date) DESC, id DESC`,
    [sprawaId],
  );
  return rows;
}

export async function znajdz(id: number): Promise<Pismo | null> {
  const { rows } = await pool.query<Pismo>(`SELECT ${kolumny()} FROM pismo WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function dodaj(dane: {
  sprawaId: number;
  kierunek: KierunekPisma;
  rodzaj: string;
  korespondent: string;
  znakPisma: string | null;
  dataNadania: string | null;
  dataDoreczenia: string | null;
  opis: string | null;
}): Promise<Pismo> {
  const { rows } = await pool.query<Pismo>(
    `INSERT INTO pismo
       (sprawa_id, kierunek, rodzaj, korespondent, znak_pisma, data_nadania, data_doreczenia, opis)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${kolumny()}`,
    [
      dane.sprawaId,
      dane.kierunek,
      dane.rodzaj,
      dane.korespondent,
      dane.znakPisma,
      dane.dataNadania,
      dane.dataDoreczenia,
      dane.opis,
    ],
  );
  return rows[0]!;
}

/**
 * Uzupełnia datę doręczenia pisma zarejestrowanego przed potwierdzeniem odbioru.
 * To zdarzenie uruchamia wyznaczenie terminu, który wcześniej nie mógł powstać.
 */
export async function ustawDateDoreczenia(id: number, data: string): Promise<Pismo | null> {
  const { rows } = await pool.query<Pismo>(
    `UPDATE pismo SET data_doreczenia = $2 WHERE id = $1 RETURNING ${kolumny()}`,
    [id, data],
  );
  return rows[0] ?? null;
}
