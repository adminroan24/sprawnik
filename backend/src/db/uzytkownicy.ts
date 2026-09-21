import { pool } from './pool.js';

export type Rola = 'uzytkownik' | 'administrator';

export type Uzytkownik = {
  id: number;
  email: string;
  imieNazwisko: string;
  rola: Rola;
  aktywny: boolean;
};

type WierszZHaslem = Uzytkownik & { hasloHash: string };

const KOLUMNY = `
  id,
  email,
  imie_nazwisko AS "imieNazwisko",
  rola,
  aktywny
`;

export async function znajdzPoEmailu(email: string): Promise<WierszZHaslem | null> {
  const { rows } = await pool.query<WierszZHaslem>(
    `SELECT ${KOLUMNY}, haslo_hash AS "hasloHash" FROM uzytkownik WHERE lower(email) = lower($1)`,
    [email],
  );
  return rows[0] ?? null;
}

export async function znajdzPoId(id: number): Promise<Uzytkownik | null> {
  const { rows } = await pool.query<Uzytkownik>(
    `SELECT ${KOLUMNY} FROM uzytkownik WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function dodaj(dane: {
  email: string;
  hasloHash: string;
  imieNazwisko: string;
  rola: Rola;
}): Promise<Uzytkownik> {
  const { rows } = await pool.query<Uzytkownik>(
    `INSERT INTO uzytkownik (email, haslo_hash, imie_nazwisko, rola)
     VALUES ($1, $2, $3, $4)
     RETURNING ${KOLUMNY}`,
    [dane.email, dane.hasloHash, dane.imieNazwisko, dane.rola],
  );
  return rows[0]!;
}
