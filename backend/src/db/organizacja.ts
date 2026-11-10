import { pool, wTransakcji } from './pool.js';
import { BladZadania, bladBrakZasobu } from '../middleware/errors.js';

export type ProfilFirmy = { nazwa: string; nip: string; email: string; telefon: string; adres: string; stronaWww: string };
export type GrupaSpraw = { id: number; rodzicId: number | null; nazwa: string; kolejnosc: number };
const kolumny = 'id, rodzic_id AS "rodzicId", nazwa, kolejnosc';
export async function profil(): Promise<ProfilFirmy> {
  const { rows } = await pool.query<ProfilFirmy>('SELECT nazwa, nip, email, telefon, adres, strona_www AS "stronaWww" FROM profil_firmy WHERE id = 1');
  return rows[0]!;
}
export async function zapiszProfil(d: ProfilFirmy) {
  await pool.query('UPDATE profil_firmy SET nazwa=$1,nip=$2,email=$3,telefon=$4,adres=$5,strona_www=$6,zmieniono=now() WHERE id=1',
    [d.nazwa,d.nip,d.email,d.telefon,d.adres,d.stronaWww]);
  return profil();
}
export async function grupy() {
  return (await pool.query<GrupaSpraw>(`SELECT ${kolumny} FROM grupa_spraw ORDER BY kolejnosc, lower(nazwa), id`)).rows;
}
export async function wymagaGrupy(id: number | null) {
  if (id !== null && !(await pool.query('SELECT id FROM grupa_spraw WHERE id=$1', [id])).rowCount) throw bladBrakZasobu('Grupa nie istnieje');
}
export async function zapiszGrupe(id: number | null, d: { nazwa: string; rodzicId: number | null; kolejnosc: number }) {
  return wTransakcji(async q => {
    // Serializuje zmiany drzewa: dwie równoczesne operacje nie mogą utworzyć cyklu.
    await q.query('SELECT pg_advisory_xact_lock(7042026)');
    if (id !== null && !(await q.query('SELECT id FROM grupa_spraw WHERE id=$1', [id])).rowCount) throw bladBrakZasobu('Grupa nie istnieje');
    if (d.rodzicId !== null) {
      if (!(await q.query('SELECT id FROM grupa_spraw WHERE id=$1', [d.rodzicId])).rowCount) throw bladBrakZasobu('Grupa nadrzędna nie istnieje');
      if (id !== null) {
        const cykl = await q.query(`WITH RECURSIVE potomkowie AS (
          SELECT id FROM grupa_spraw WHERE id=$1 UNION ALL
          SELECT g.id FROM grupa_spraw g JOIN potomkowie p ON g.rodzic_id=p.id)
          SELECT id FROM potomkowie WHERE id=$2`, [id, d.rodzicId]);
        if (cykl.rowCount) throw new BladZadania(400, 'Nie można przenieść grupy do niej samej ani do jej podgrupy');
      }
    }
    const { rows } = id === null ? await q.query<GrupaSpraw>(
      `INSERT INTO grupa_spraw(nazwa,rodzic_id,kolejnosc) VALUES($1,$2,$3) RETURNING ${kolumny}`, [d.nazwa,d.rodzicId,d.kolejnosc]) :
      await q.query<GrupaSpraw>(`UPDATE grupa_spraw SET nazwa=$2,rodzic_id=$3,kolejnosc=$4 WHERE id=$1 RETURNING ${kolumny}`, [id,d.nazwa,d.rodzicId,d.kolejnosc]);
    return rows[0]!;
  }).catch((blad: { code?: string }) => {
    if (blad.code === '23505') throw new BladZadania(409, 'W tym miejscu istnieje już grupa o tej nazwie');
    throw blad;
  });
}
export async function usunGrupe(id: number) {
  return wTransakcji(async q => {
    await q.query('SELECT pg_advisory_xact_lock(7042026)');
    if (!(await q.query('SELECT id FROM grupa_spraw WHERE id=$1 FOR UPDATE', [id])).rowCount) throw bladBrakZasobu('Grupa nie istnieje');
    if ((await q.query('SELECT id FROM grupa_spraw WHERE rodzic_id=$1 UNION ALL SELECT id FROM sprawa WHERE grupa_id=$1 LIMIT 1', [id])).rowCount) {
      throw new BladZadania(409, 'Grupa zawiera podgrupy lub sprawy. Najpierw przenieś jej zawartość.');
    }
    await q.query('DELETE FROM grupa_spraw WHERE id=$1', [id]);
  });
}

/** Szablon dodawany wyłącznie do pustego drzewa; nie nadpisuje konfiguracji. */
export async function szablonCreationX() {
  await wTransakcji(async q => {
    await q.query('SELECT pg_advisory_xact_lock(7042026)');
    if ((await q.query('SELECT id FROM grupa_spraw LIMIT 1')).rowCount) throw new BladZadania(409, 'Szablon można zastosować tylko do pustego drzewa');
    const dodaj = async (nazwa: string, rodzic: number | null, kolejnosc: number) =>
      (await q.query<{ id: number }>('INSERT INTO grupa_spraw(nazwa,rodzic_id,kolejnosc) VALUES($1,$2,$3) RETURNING id', [nazwa,rodzic,kolejnosc])).rows[0]!.id;
    const firma = await dodaj('Sprawy własne firmy', null, 10);
    const urzedy = await dodaj('Urzędy', firma, 10);
    await dodaj('Urząd Skarbowy', urzedy, 10); await dodaj('ZUS', urzedy, 20);
    for (const [i, nazwa] of ['Księgowość i rozliczenia','Banki, leasing i finansowanie','Dostawcy i umowy','Biuro i administracja','Spory i reklamacje'].entries()) await dodaj(nazwa, firma, (i + 2) * 10);
    await dodaj('Klienci', null, 20);
    await dodaj('Przetargi i postępowania ofertowe', null, 30);
  });
  return grupy();
}
