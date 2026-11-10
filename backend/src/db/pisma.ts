import { pool, type Wykonawca } from './pool.js';

export type KierunekPisma = 'przychodzace' | 'wychodzace';
export type KanalPisma = 'email' | 'edoreczenia' | 'epuap' | 'poczta' | 'osobiscie' | 'inne';

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
  kanal: KanalPisma | null;
  numerNadania: string | null;
  odpowiedzNaPismoId: number | null;
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
  ${prefiks}kanal,
  ${prefiks}numer_nadania AS "numerNadania",
  ${prefiks}odpowiedz_na_pismo_id AS "odpowiedzNaPismoId",
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

export async function znajdz(id: number, wykonawca: Wykonawca = pool, blokuj = false): Promise<Pismo | null> {
  const { rows } = await wykonawca.query<Pismo>(
    `SELECT ${kolumny()} FROM pismo WHERE id = $1 ${blokuj ? 'FOR UPDATE' : ''}`, [id]);
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
  kanal?: KanalPisma | null;
  numerNadania?: string | null;
  odpowiedzNaPismoId?: number | null;
}, wykonawca: Wykonawca = pool): Promise<Pismo> {
  const { rows } = await wykonawca.query<Pismo>(
    `INSERT INTO pismo
       (sprawa_id, kierunek, rodzaj, korespondent, znak_pisma, data_nadania, data_doreczenia, opis,
        kanal, numer_nadania, odpowiedz_na_pismo_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
      dane.kanal ?? null, dane.numerNadania ?? null, dane.odpowiedzNaPismoId ?? null,
    ],
  );
  return rows[0]!;
}

/**
 * Uzupełnia datę doręczenia pisma zarejestrowanego przed potwierdzeniem odbioru.
 * To zdarzenie uruchamia wyznaczenie terminu, który wcześniej nie mógł powstać.
 */
export async function ustawDateDoreczenia(id: number, data: string, wykonawca: Wykonawca = pool): Promise<Pismo | null> {
  const { rows } = await wykonawca.query<Pismo>(
    `UPDATE pismo SET data_doreczenia = $2 WHERE id = $1 RETURNING ${kolumny()}`,
    [id, data],
  );
  return rows[0] ?? null;
}

export async function ustawNadanie(id: number, data: string, kanal: KanalPisma | null,
  numer: string | null, wykonawca: Wykonawca): Promise<Pismo> {
  const { rows } = await wykonawca.query<Pismo>(
    `UPDATE pismo SET data_nadania = $2, kanal = coalesce($3, kanal),
       numer_nadania = coalesce($4, numer_nadania) WHERE id = $1 RETURNING ${kolumny()}`,
    [id, data, kanal, numer],
  );
  return rows[0]!;
}
