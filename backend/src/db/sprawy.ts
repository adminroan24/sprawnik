import { pool } from './pool.js';

export type StatusSprawy = 'w_toku' | 'zawieszona' | 'zakonczona';

export type Sprawa = {
  id: number;
  uzytkownikId: number;
  tytul: string;
  znakWlasny: string | null;
  organ: string | null;
  status: StatusSprawy;
  dataWszczecia: string | null;
  opis: string | null;
  utworzono: string;
};

export type SprawaNaLiscie = Sprawa & {
  liczbaPism: number;
  liczbaTerminowOtwartych: number;
  najblizszyTermin: string | null;
};

/** Wykaz kolumn sprawy. Prefiks podawany jest tam, gdzie zapytanie łączy tabele. */
const kolumny = (prefiks = '') => `
  ${prefiks}id,
  ${prefiks}uzytkownik_id  AS "uzytkownikId",
  ${prefiks}tytul,
  ${prefiks}znak_wlasny    AS "znakWlasny",
  ${prefiks}organ,
  ${prefiks}status,
  ${prefiks}data_wszczecia AS "dataWszczecia",
  ${prefiks}opis,
  ${prefiks}utworzono
`;

/**
 * Lista spraw prowadzonych przez użytkownika wraz z podsumowaniem zawartości (UC10).
 *
 * Liczba pism, liczba terminów otwartych i data najbliższego z nich liczone są
 * w zapytaniu, a nie przez odpytywanie bazy osobno dla każdej sprawy.
 */
export async function lista(
  uzytkownikId: number,
  filtr: { szukaj?: string; status?: StatusSprawy } = {},
): Promise<SprawaNaLiscie[]> {
  const { rows } = await pool.query<SprawaNaLiscie>(
    `SELECT ${kolumny('s.')},
            count(DISTINCT p.id)::int AS "liczbaPism",
            count(DISTINCT t.id) FILTER (WHERE t.status = 'otwarty')::int AS "liczbaTerminowOtwartych",
            min(t.data_uplywu) FILTER (WHERE t.status = 'otwarty') AS "najblizszyTermin"
       FROM sprawa s
       LEFT JOIN pismo p  ON p.sprawa_id = s.id
       LEFT JOIN termin t ON t.sprawa_id = s.id
      WHERE s.uzytkownik_id = $1
        AND ($2::text IS NULL OR s.tytul ILIKE '%' || $2 || '%'
                              OR coalesce(s.znak_wlasny, '') ILIKE '%' || $2 || '%'
                              OR coalesce(s.organ, '') ILIKE '%' || $2 || '%')
        AND ($3::status_sprawy IS NULL OR s.status = $3)
      GROUP BY s.id
      ORDER BY s.utworzono DESC`,
    [uzytkownikId, filtr.szukaj ?? null, filtr.status ?? null],
  );
  return rows;
}

export async function znajdz(id: number): Promise<Sprawa | null> {
  const { rows } = await pool.query<Sprawa>(
    `SELECT ${kolumny('s.')} FROM sprawa s WHERE s.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function dodaj(dane: {
  uzytkownikId: number;
  tytul: string;
  znakWlasny: string | null;
  organ: string | null;
  dataWszczecia: string | null;
  opis: string | null;
}): Promise<Sprawa> {
  const { rows } = await pool.query<Sprawa>(
    `INSERT INTO sprawa (uzytkownik_id, tytul, znak_wlasny, organ, data_wszczecia, opis)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${kolumny()}`,
    [dane.uzytkownikId, dane.tytul, dane.znakWlasny, dane.organ, dane.dataWszczecia, dane.opis],
  );
  return rows[0]!;
}

export async function aktualizuj(
  id: number,
  zmiany: Partial<Pick<Sprawa, 'tytul' | 'znakWlasny' | 'organ' | 'status' | 'dataWszczecia' | 'opis'>>,
): Promise<Sprawa | null> {
  // Aktualizacja częściowa: pominięte pole zachowuje dotychczasową wartość,
  // co odróżnia „nie zmieniaj" od „wyczyść".
  const { rows } = await pool.query<Sprawa>(
    `UPDATE sprawa SET
       tytul          = coalesce($2, tytul),
       znak_wlasny    = CASE WHEN $3::boolean THEN $4 ELSE znak_wlasny END,
       organ          = CASE WHEN $5::boolean THEN $6 ELSE organ END,
       status         = coalesce($7::status_sprawy, status),
       data_wszczecia = CASE WHEN $8::boolean THEN $9::date ELSE data_wszczecia END,
       opis           = CASE WHEN $10::boolean THEN $11 ELSE opis END
     WHERE id = $1
     RETURNING ${kolumny()}`,
    [
      id,
      zmiany.tytul ?? null,
      'znakWlasny' in zmiany, zmiany.znakWlasny ?? null,
      'organ' in zmiany, zmiany.organ ?? null,
      zmiany.status ?? null,
      'dataWszczecia' in zmiany, zmiany.dataWszczecia ?? null,
      'opis' in zmiany, zmiany.opis ?? null,
    ],
  );
  return rows[0] ?? null;
}

/**
 * Chronologia sprawy (UC11) — pisma, terminy i dokumenty jednej sprawy
 * uporządkowane datą. Nie ma własnej tabeli: powstaje jako suma zapytań,
 * bo osobna tabela zdarzeń dublowałaby dane już zapisane.
 */
export type ZdarzenieChronologii = {
  data: string;
  rodzaj: 'pismo' | 'termin' | 'dokument';
  opis: string;
};

export async function chronologia(sprawaId: number): Promise<ZdarzenieChronologii[]> {
  const { rows } = await pool.query<ZdarzenieChronologii>(
    `SELECT coalesce(p.data_doreczenia, p.data_nadania, p.utworzono::date) AS data,
            'pismo'::text AS rodzaj,
            CASE p.kierunek
              WHEN 'przychodzace' THEN 'Wpłynęło: '
              ELSE 'Wysłano: '
            END || p.rodzaj || ' — ' || p.korespondent AS opis
       FROM pismo p
      WHERE p.sprawa_id = $1
      UNION ALL
     SELECT t.data_uplywu, 'termin', 'Termin: ' || t.czynnosc
       FROM termin t
      WHERE t.sprawa_id = $1
      UNION ALL
     SELECT d.dodano::date, 'dokument', 'Dokument: ' || d.nazwa_oryginalna
       FROM dokument d
       JOIN pismo p ON p.id = d.pismo_id
      WHERE p.sprawa_id = $1
      ORDER BY data, rodzaj`,
    [sprawaId],
  );
  return rows;
}
