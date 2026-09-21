import { pool } from './pool.js';
import type { SposobWyznaczenia, StatusTerminu } from '../services/terminy.js';

export type Termin = {
  id: number;
  sprawaId: number;
  pismoId: number | null;
  regulaId: number | null;
  czynnosc: string;
  dataPoczatkowa: string;
  dataUplywu: string;
  sposobWyznaczenia: SposobWyznaczenia;
  status: StatusTerminu;
  dataWykonania: string | null;
};

/** Termin wraz z kontekstem potrzebnym na liście zbiorczej (UC8). */
export type TerminZKontekstem = Termin & {
  tytulSprawy: string;
  nazwaReguly: string | null;
};

const kolumny = (prefiks = '') => `
  ${prefiks}id,
  ${prefiks}sprawa_id          AS "sprawaId",
  ${prefiks}pismo_id           AS "pismoId",
  ${prefiks}regula_id          AS "regulaId",
  ${prefiks}czynnosc,
  ${prefiks}data_poczatkowa    AS "dataPoczatkowa",
  ${prefiks}data_uplywu        AS "dataUplywu",
  ${prefiks}sposob_wyznaczenia AS "sposobWyznaczenia",
  ${prefiks}status,
  ${prefiks}data_wykonania     AS "dataWykonania"
`;

export async function listaDlaSprawy(sprawaId: number): Promise<TerminZKontekstem[]> {
  const { rows } = await pool.query<TerminZKontekstem>(
    `SELECT ${kolumny('t.')}, s.tytul AS "tytulSprawy", r.nazwa AS "nazwaReguly"
       FROM termin t
       JOIN sprawa s ON s.id = t.sprawa_id
       LEFT JOIN regula_terminu r ON r.id = t.regula_id
      WHERE t.sprawa_id = $1
      ORDER BY t.data_uplywu`,
    [sprawaId],
  );
  return rows;
}

/** Terminy wszystkich spraw użytkownika — podstawa przeglądu i ostrzegania. */
export async function listaUzytkownika(
  uzytkownikId: number,
  status: StatusTerminu | null = 'otwarty',
): Promise<TerminZKontekstem[]> {
  const { rows } = await pool.query<TerminZKontekstem>(
    `SELECT ${kolumny('t.')}, s.tytul AS "tytulSprawy", r.nazwa AS "nazwaReguly"
       FROM termin t
       JOIN sprawa s ON s.id = t.sprawa_id
       LEFT JOIN regula_terminu r ON r.id = t.regula_id
      WHERE s.uzytkownik_id = $1
        AND ($2::status_terminu IS NULL OR t.status = $2)
      ORDER BY t.data_uplywu`,
    [uzytkownikId, status],
  );
  return rows;
}

export async function znajdz(id: number): Promise<Termin | null> {
  const { rows } = await pool.query<Termin>(`SELECT ${kolumny()} FROM termin WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function dodaj(dane: {
  sprawaId: number;
  pismoId: number | null;
  regulaId: number | null;
  czynnosc: string;
  dataPoczatkowa: string;
  dataUplywu: string;
  sposobWyznaczenia: SposobWyznaczenia;
}): Promise<Termin> {
  const { rows } = await pool.query<Termin>(
    `INSERT INTO termin
       (sprawa_id, pismo_id, regula_id, czynnosc, data_poczatkowa, data_uplywu, sposob_wyznaczenia)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${kolumny()}`,
    [
      dane.sprawaId,
      dane.pismoId,
      dane.regulaId,
      dane.czynnosc,
      dane.dataPoczatkowa,
      dane.dataUplywu,
      dane.sposobWyznaczenia,
    ],
  );
  return rows[0]!;
}

/**
 * Zmienia status terminu. Data wykonania towarzyszy wyłącznie statusowi
 * „wykonany" — ograniczenie w bazie nie dopuszcza innego zestawienia.
 */
export async function zmienStatus(
  id: number,
  status: StatusTerminu,
  dataWykonania: string | null,
): Promise<Termin | null> {
  const { rows } = await pool.query<Termin>(
    `UPDATE termin
        SET status = $2,
            data_wykonania = CASE WHEN $2::status_terminu = 'wykonany' THEN $3::date ELSE NULL END
      WHERE id = $1
      RETURNING ${kolumny()}`,
    [id, status, dataWykonania],
  );
  return rows[0] ?? null;
}
