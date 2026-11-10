import { pool, type Wykonawca } from './pool.js';
import { BladZadania, bladBrakZasobu } from '../middleware/errors.js';

export type DaneKontaktu = { typ: 'osoba' | 'firma' | 'instytucja'; nazwa: string; nip: string; email: string;
  telefon: string; adres: string; adresEdoreczen: string; skrzynkaEpuap: string; osobaKontaktowa: string };
export type Kontakt = DaneKontaktu & { id: number; notatka: string; aktywny: boolean };
const kolumny = `id, typ, nazwa, nip, email, telefon, adres, adres_edoreczen AS "adresEdoreczen",
  skrzynka_epuap AS "skrzynkaEpuap", osoba_kontaktowa AS "osobaKontaktowa", notatka, aktywny`;

export async function lista(szukaj: string, archiwalne: boolean) {
  return (await pool.query<Kontakt>(`SELECT ${kolumny} FROM kontakt
    WHERE ($1 OR aktywny) AND ($2 = '' OR concat_ws(' ', nazwa, nip, email, telefon, adres, adres_edoreczen, skrzynka_epuap, osoba_kontaktowa) ILIKE $3)
    ORDER BY lower(nazwa), id`, [archiwalne, szukaj, '%' + szukaj + '%'])).rows;
}
export async function znajdz(id: number, q: Wykonawca = pool, blokuj = false) {
  return (await q.query<Kontakt>(`SELECT ${kolumny} FROM kontakt WHERE id=$1 ${blokuj ? 'FOR SHARE' : ''}`, [id])).rows[0] ?? null;
}
export async function zapisz(id: number | null, d: Omit<Kontakt, 'id'>) {
  const wartosci = [d.typ,d.nazwa,d.nip,d.email,d.telefon,d.adres,d.adresEdoreczen,d.skrzynkaEpuap,d.osobaKontaktowa,d.notatka,d.aktywny];
  const wynik = id === null ? await pool.query<Kontakt>(`INSERT INTO kontakt
    (typ,nazwa,nip,email,telefon,adres,adres_edoreczen,skrzynka_epuap,osoba_kontaktowa,notatka,aktywny)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ${kolumny}`, wartosci) :
    await pool.query<Kontakt>(`UPDATE kontakt SET typ=$1,nazwa=$2,nip=$3,email=$4,telefon=$5,adres=$6,
    adres_edoreczen=$7,skrzynka_epuap=$8,osoba_kontaktowa=$9,notatka=$10,aktywny=$11,zmieniono=now()
    WHERE id=$12 RETURNING ${kolumny}`, [...wartosci,id]);
  if (!wynik.rows[0]) throw bladBrakZasobu('Kontakt nie istnieje');
  return wynik.rows[0];
}
export async function usun(id: number) {
  try {
    if (!(await pool.query('DELETE FROM kontakt WHERE id=$1', [id])).rowCount) throw bladBrakZasobu('Kontakt nie istnieje');
  } catch (blad) {
    if ((blad as { code?: string }).code === '23503') throw new BladZadania(409, 'Kontakt jest powiązany z pismami. Wyłącz go zamiast usuwać.');
    throw blad;
  }
}
/** Tylko dane potrzebne do korespondencji; bez wewnętrznej notatki i stanu kontaktu. */
export function kopia(k: Kontakt): DaneKontaktu {
  const { typ,nazwa,nip,email,telefon,adres,adresEdoreczen,skrzynkaEpuap,osobaKontaktowa } = k;
  return { typ,nazwa,nip,email,telefon,adres,adresEdoreczen,skrzynkaEpuap,osobaKontaktowa };
}
