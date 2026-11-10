import { pool } from './pool.js';

export type Dokument = {
  id: number;
  pismoId: number;
  nazwaOryginalna: string;
  typMime: string;
  rozmiarBajtow: number;
  sumaKontrolna: string;
  dodano: string;
};

const kolumny = `d.id, d.pismo_id AS "pismoId", d.nazwa_oryginalna AS "nazwaOryginalna",
  d.typ_mime AS "typMime", d.rozmiar_bajtow AS "rozmiarBajtow",
  d.suma_kontrolna AS "sumaKontrolna", d.dodano`;

export async function dodaj(dane: {
  pismoId: number;
  uzytkownikId: number;
  nazwaOryginalna: string;
  nazwaWMagazynie: string;
  rozmiarBajtow: number;
  sumaKontrolna: string;
}): Promise<Dokument> {
  const { rows } = await pool.query<Dokument>(
    `INSERT INTO dokument AS d
       (pismo_id, dodal_uzytkownik_id, nazwa_oryginalna, nazwa_w_magazynie,
        typ_mime, rozmiar_bajtow, suma_kontrolna)
     VALUES ($1, $2, $3, $4, 'application/octet-stream', $5, $6)
     RETURNING ${kolumny}`,
    [dane.pismoId, dane.uzytkownikId, dane.nazwaOryginalna,
      dane.nazwaWMagazynie, dane.rozmiarBajtow, dane.sumaKontrolna],
  );
  return rows[0]!;
}

export async function lista(sprawaId: number, filtr: { szukaj?: string; pismoId?: number }) {
  const { rows } = await pool.query<Dokument>(
    `SELECT ${kolumny} FROM dokument d JOIN pismo p ON p.id = d.pismo_id
     WHERE p.sprawa_id = $1
       AND ($2::text IS NULL OR d.nazwa_oryginalna ILIKE '%' || $2 || '%')
       AND ($3::bigint IS NULL OR d.pismo_id = $3)
     ORDER BY d.dodano DESC, d.id DESC`,
    [sprawaId, filtr.szukaj ?? null, filtr.pismoId ?? null],
  );
  return rows;
}

/** Własność sprawy sprawdzana także przy pobieraniu pojedynczego pliku. */
export async function znajdzDlaUzytkownika(id: number, uzytkownikId: number) {
  const { rows } = await pool.query<Dokument & { nazwaWMagazynie: string }>(
    `SELECT ${kolumny}, d.nazwa_w_magazynie AS "nazwaWMagazynie"
       FROM dokument d JOIN pismo p ON p.id = d.pismo_id
       JOIN sprawa s ON s.id = p.sprawa_id
      WHERE d.id = $1 AND s.uzytkownik_id = $2`,
    [id, uzytkownikId],
  );
  return rows[0] ?? null;
}
