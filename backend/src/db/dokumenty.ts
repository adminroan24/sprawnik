import { pool } from './pool.js';

export type Dokument = {
  id: number;
  pismoId: number;
  nazwaOryginalna: string;
  typMime: string;
  rozmiarBajtow: number;
  sumaKontrolna: string;
  dodano: string;
  rola: RolaDokumentu;
  ocrGotowy: boolean;
};

export type RolaDokumentu = 'tresc' | 'zalacznik' | 'dowod_nadania' | 'potwierdzenie_odbioru';

const kolumny = `d.id, d.pismo_id AS "pismoId", d.nazwa_oryginalna AS "nazwaOryginalna",
  d.typ_mime AS "typMime", d.rozmiar_bajtow AS "rozmiarBajtow",
  d.suma_kontrolna AS "sumaKontrolna", d.dodano, d.rola,
  EXISTS (SELECT 1 FROM dokument_ocr o WHERE o.dokument_id = d.id) AS "ocrGotowy"`;

export async function dodaj(dane: {
  pismoId: number;
  uzytkownikId: number;
  nazwaOryginalna: string;
  nazwaWMagazynie: string;
  rozmiarBajtow: number;
  sumaKontrolna: string;
  rola?: RolaDokumentu;
}): Promise<Dokument> {
  const { rows } = await pool.query<Dokument>(
    `INSERT INTO dokument AS d
       (pismo_id, dodal_uzytkownik_id, nazwa_oryginalna, nazwa_w_magazynie,
        typ_mime, rozmiar_bajtow, suma_kontrolna, rola)
     VALUES ($1, $2, $3, $4, 'application/octet-stream', $5, $6, $7)
     RETURNING ${kolumny}`,
    [dane.pismoId, dane.uzytkownikId, dane.nazwaOryginalna,
      dane.nazwaWMagazynie, dane.rozmiarBajtow, dane.sumaKontrolna, dane.rola ?? 'zalacznik'],
  );
  return rows[0]!;
}

export async function lista(sprawaId: number, filtr: {
  szukaj?: string; pismoId?: number; wTresci?: boolean; rola?: RolaDokumentu;
}) {
  const { rows } = await pool.query<Dokument>(
    `SELECT ${kolumny} FROM dokument d JOIN pismo p ON p.id = d.pismo_id
     WHERE p.sprawa_id = $1
       AND ($2::text IS NULL OR d.nazwa_oryginalna ILIKE '%' || $2 || '%'
         OR ($4::boolean AND EXISTS (SELECT 1 FROM dokument_ocr o
           WHERE o.dokument_id = d.id AND o.tekst ILIKE '%' || $2 || '%')))
       AND ($3::bigint IS NULL OR d.pismo_id = $3)
       AND ($5::text IS NULL OR d.rola = $5)
     ORDER BY d.dodano DESC, d.id DESC`,
    [sprawaId, filtr.szukaj ?? null, filtr.pismoId ?? null, filtr.wTresci ?? false, filtr.rola ?? null],
  );
  return rows;
}

export type WynikOcr = { tekst: string; jezyki: string; liczbaStron: number; wykonano: string };

export async function zapiszOcr(id: number, tekst: string, liczbaStron: number): Promise<WynikOcr> {
  const { rows } = await pool.query<WynikOcr>(
    `INSERT INTO dokument_ocr (dokument_id, tekst, jezyki, liczba_stron)
     VALUES ($1, $2, 'pol+eng', $3)
     ON CONFLICT (dokument_id) DO UPDATE SET tekst = EXCLUDED.tekst,
       liczba_stron = EXCLUDED.liczba_stron, wykonano = now()
     RETURNING tekst, jezyki, liczba_stron AS "liczbaStron", wykonano`, [id, tekst, liczbaStron],
  );
  return rows[0]!;
}

export async function odczytajOcr(id: number): Promise<WynikOcr | null> {
  const { rows } = await pool.query<WynikOcr>(
    `SELECT tekst, jezyki, liczba_stron AS "liczbaStron", wykonano
     FROM dokument_ocr WHERE dokument_id = $1`, [id],
  );
  return rows[0] ?? null;
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
