import { createHash, randomUUID } from 'node:crypto';
import { constants, type Stats } from 'node:fs';
import { mkdir, open, readdir, readFile, lstat, rename, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { BladZadania, bladBrakZasobu } from '../middleware/errors.js';
import { LIMIT_PLIKU, zapiszDokument } from './dokumenty.js';
import { odczytajTekstPliku } from './ocr.js';
import { dopasujSprawy } from './dopasowanie.js';
import { sprawyUzytkownika } from '../db/dopasowanie.js';
import { pool, wTransakcji } from '../db/pool.js';
import { wczytajKalendarz } from '../db/kalendarz.js';
import * as pismaDb from '../db/pisma.js';
import * as terminyDb from '../db/terminy.js';
import { odczytajTerminyOdpowiedzi, wyliczTerminOdpowiedzi, type UstawieniaTerminu, type TerminZeSkanu } from './termin-odpowiedzi.js';
import * as dokumentyDb from '../db/dokumenty.js';

const ZRODLA = ['epson', 'kyocera'] as const;
const aktywneImporty = new Set<string>();
const cache = new Map<string, Awaited<ReturnType<typeof odczytajTekstPliku>>>();
const rozpoznawane = new Map<string, Promise<Awaited<ReturnType<typeof odczytajTekstPliku>>>>();
const statusy = new Map<string, { odcisk: string; stan: 'oczekuje' | 'przetwarzanie' | 'gotowe' | 'blad'; ponowPo: number }>();
const katalog = () => path.resolve(process.env.SCAN_INBOX_DIR ?? path.join(env.uploadDir, '..', 'skany'));
const archiwum = () => path.resolve(process.env.SCAN_ARCHIVE_DIR ?? path.join(katalog(), '..', 'skany-archiwum'));
const hash = (plik: Buffer) => createHash('sha256').update(plik).digest('hex');
const odcisk = (stat: Stats) => `${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
const plikMetadanych = (id: string) => path.join(archiwum(), 'metadane-skanow', hash(Buffer.from(id)) + '.json');
type MetadaneSkanu = { dataWplywu: string; sha256: string; odcisk: string; zapisalUzytkownikId: number; zapisano: string; terminOdpowiedzi?: TerminZeSkanu };

async function metadaneSkanu(id: string, stat: Stats): Promise<MetadaneSkanu | null> {
  try {
    const dane = JSON.parse(await readFile(plikMetadanych(id), 'utf8')) as MetadaneSkanu;
    return dane.odcisk === odcisk(stat) && /^\d{4}-\d{2}-\d{2}$/.test(dane.dataWplywu) ? dane : null;
  } catch { return null; }
}

async function zwyklyFolder(zrodlo: string) {
  const stat = await lstat(path.join(katalog(), zrodlo)).catch(() => null);
  return stat?.isDirectory() && !stat.isSymbolicLink();
}

function czesci(id: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw bladBrakZasobu('Skan nie istnieje');
  const decoded = Buffer.from(id, 'base64url').toString('utf8');
  if (Buffer.from(decoded).toString('base64url') !== id) throw bladBrakZasobu('Skan nie istnieje');
  const [zrodlo, nazwa, ...reszta] = decoded.split('/');
  if (!zrodlo || !ZRODLA.includes(zrodlo as typeof ZRODLA[number]) || !nazwa || reszta.length ||
      /[\\\x00-\x1f]/.test(nazwa) || nazwa.startsWith('.') || !/\.(pdf|png|jpe?g)$/i.test(nazwa)) {
    throw bladBrakZasobu('Skan nie istnieje');
  }
  return { zrodlo, nazwa, sciezka: path.join(katalog(), zrodlo, nazwa) };
}

export async function listaSkanow() {
  const skany = [];
  for (const zrodlo of ZRODLA) {
    if (!await zwyklyFolder(zrodlo)) continue;
    const folder = path.join(katalog(), zrodlo);
    const pliki = await readdir(folder, { withFileTypes: true }).catch((blad: NodeJS.ErrnoException) => {
      if (blad.code === 'ENOENT') return []; throw blad;
    });
    for (const plik of pliki.slice(0, 1000)) {
      if (!plik.isFile() || plik.name.startsWith('.') || !/\.(pdf|png|jpe?g)$/i.test(plik.name)) continue;
      const stat = await lstat(path.join(folder, plik.name)).catch(() => null);
      if (!stat?.isFile()) continue;
      const id = Buffer.from(`${zrodlo}/${plik.name}`).toString('base64url');
      const metadane = await metadaneSkanu(id, stat);
      skany.push({ id, dataWplywu: metadane?.dataWplywu ?? null, terminOdpowiedzi: metadane?.terminOdpowiedzi ?? null,
        nazwa: plik.name, zrodlo, rozmiarBajtow: stat.size, zmieniono: stat.mtime.toISOString(),
        stanOcr: statusy.get(id)?.odcisk === odcisk(stat) ? statusy.get(id)!.stan : 'oczekuje',
        gotowy: Date.now() - stat.mtimeMs >= 10_000, zaDuzy: stat.size > LIMIT_PLIKU });
    }
  }
  return skany.sort((a, b) => b.zmieniono.localeCompare(a.zmieniono));
}

async function odczytaj(id: string) {
  const info = czesci(id);
  if (!await zwyklyFolder(info.zrodlo)) throw bladBrakZasobu('Katalog skanera nie istnieje');
  let uchwyt;
  try { uchwyt = await open(info.sciezka, constants.O_RDONLY | constants.O_NOFOLLOW); }
  catch { throw bladBrakZasobu('Skan nie istnieje lub nie jest zwykłym plikiem'); }
  try {
    const przed = await uchwyt.stat();
    if (!przed.isFile()) throw bladBrakZasobu('Skan nie istnieje');
    if (Date.now() - przed.mtimeMs < 10_000) throw new BladZadania(409, 'Odbiór skanu może jeszcze trwać. Odczekaj chwilę i odśwież listę.');
    if (przed.size === 0 || przed.size > LIMIT_PLIKU) throw new BladZadania(413, 'Skan musi mieć rozmiar od 1 bajta do 10 MiB');
    const plik = await uchwyt.readFile();
    const po = await uchwyt.stat();
    if (po.mtimeMs !== przed.mtimeMs || po.size !== przed.size || plik.length !== przed.size) {
      throw new BladZadania(409, 'Plik zmienił się podczas odczytu. Spróbuj ponownie po zakończeniu odbioru.');
    }
    return { ...info, plik, sha256: hash(plik), stat: po };
  } finally { await uchwyt.close(); }
}

async function zapiszMetadane(id: string, dane: MetadaneSkanu) {
  const docelowy = plikMetadanych(id);
  await mkdir(path.dirname(docelowy), { recursive: true, mode: 0o700 });
  const tymczasowy = docelowy + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(tymczasowy, JSON.stringify(dane), { flag: 'wx', mode: 0o600 });
    await rename(tymczasowy, docelowy);
  } finally { await unlink(tymczasowy).catch(() => undefined); }
}

/** Zapis niezależny od sprawy i pisma. Metadane są poza udziałem skanerów. */
export async function zapiszDateWplywu(id: string, dataWplywu: string, uzytkownikId: number, oczekiwanyHash?: string) {
  if (aktywneImporty.has(id)) throw new BladZadania(409, 'Ten skan jest już przetwarzany');
  aktywneImporty.add(id);
  try {
    const skan = await odczytaj(id);
    if (oczekiwanyHash && skan.sha256 !== oczekiwanyHash) {
      throw new BladZadania(409, 'Skan zmienił się od rozpoznania. Wybierz i sprawdź plik ponownie.');
    }
    const poprzednie = await metadaneSkanu(id, skan.stat);
    const terminOdpowiedzi = poprzednie?.terminOdpowiedzi ? wyliczTerminOdpowiedzi(
      poprzednie.terminOdpowiedzi.ustawienia, dataWplywu, await wczytajKalendarz()) : undefined;
    const dane: MetadaneSkanu = { dataWplywu, sha256: skan.sha256, odcisk: odcisk(skan.stat),
      zapisalUzytkownikId: uzytkownikId, zapisano: new Date().toISOString(), terminOdpowiedzi };
    await zapiszMetadane(id, dane);
    return { dataWplywu, zapisano: dane.zapisano, terminOdpowiedzi: terminOdpowiedzi ?? null };
  } finally { aktywneImporty.delete(id); }
}

export async function terminOdpowiedziSkanu(id: string, ustawienia: UstawieniaTerminu, zapisuj: boolean, uzytkownikId: number) {
  if (aktywneImporty.has(id)) throw new BladZadania(409, 'Ten skan jest już przetwarzany');
  aktywneImporty.add(id);
  try {
    const skan = await odczytaj(id);
    const metadane = await metadaneSkanu(id, skan.stat);
    if (!metadane || metadane.sha256 !== skan.sha256) throw new BladZadania(400, 'Najpierw zapisz datę wpływu tego skanu');
    const terminOdpowiedzi = wyliczTerminOdpowiedzi(ustawienia, metadane.dataWplywu, await wczytajKalendarz());
    if (zapisuj) await zapiszMetadane(id, { ...metadane, terminOdpowiedzi,
      zapisalUzytkownikId: uzytkownikId, zapisano: new Date().toISOString() });
    return { terminOdpowiedzi };
  } finally { aktywneImporty.delete(id); }
}

async function przeniesTerminDoSprawy(pismoId: number, termin: TerminZeSkanu) {
  return wTransakcji(async wykonawca => {
    const pismo = await pismaDb.znajdz(pismoId, wykonawca, true);
    if (!pismo) throw bladBrakZasobu('Pismo nie istnieje');
    const { rows } = await wykonawca.query<{ id: number; data: string }>(
      `SELECT id, data_uplywu AS data FROM termin WHERE pismo_id = $1 AND status <> 'anulowany'
       AND czynnosc = 'Termin odpowiedzi / wykonania' ORDER BY id LIMIT 1`, [pismoId]);
    if (rows[0]) {
      if (rows[0].data !== termin.dataUplywu) throw new BladZadania(409, 'Pismo ma inny termin odpowiedzi. Sprawdź terminy w sprawie przed importem.');
      return rows[0].id;
    }
    const nowy = await terminyDb.dodaj({ sprawaId: pismo.sprawaId, pismoId, regulaId: null,
      czynnosc: 'Termin odpowiedzi / wykonania', dataPoczatkowa: termin.dataPoczatkowa,
      dataUplywu: termin.dataUplywu, sposobWyznaczenia: 'reczny' }, wykonawca);
    return nowy.id;
  });
}

/** Wynik OCR jest wspólny, dopasowania spraw są wyliczane osobno dla właściciela. */
async function wynikOcr(skan: Awaited<ReturnType<typeof odczytaj>>, uruchom: boolean) {
  const zapis = path.join(archiwum(), 'ocr-skanow', skan.sha256 + '.json');
  let wynik = cache.get(zapis);
  if (!wynik) {
    try {
      const dane = JSON.parse(await readFile(zapis, 'utf8'));
      if (dane.sha256 === skan.sha256 && typeof dane.tekst === 'string' && dane.tekst.length > 0 &&
          dane.tekst.length <= 1_000_000 && Number.isInteger(dane.liczbaStron) && dane.liczbaStron >= 1 && dane.liczbaStron <= 20) {
        wynik = { tekst: dane.tekst, jezyki: 'pol+eng', liczbaStron: dane.liczbaStron };
      }
    } catch { /* Brak lub uszkodzenie zapisu oznacza konieczność ponownego OCR. */ }
  }
  if (!wynik && !uruchom) return null;
  if (!wynik) {
    let zadanie = rozpoznawane.get(zapis);
    if (!zadanie) {
      zadanie = (async () => {
        const wynik = await odczytajTekstPliku(skan.plik);
        await mkdir(path.dirname(zapis), { recursive: true, mode: 0o700 });
        const tmp = zapis + '.' + randomUUID();
        try {
          await writeFile(tmp, JSON.stringify({ ...wynik, sha256: skan.sha256 }), { flag: 'wx', mode: 0o600 });
          await rename(tmp, zapis);
        } finally { await unlink(tmp).catch(() => undefined); }
        return wynik;
      })();
      rozpoznawane.set(zapis, zadanie);
    }
    try { wynik = await zadanie; }
    finally { if (rozpoznawane.get(zapis) === zadanie) rozpoznawane.delete(zapis); }
  }
  if (cache.size >= 30) cache.delete(cache.keys().next().value!);
  cache.set(zapis, wynik);
  statusy.set(Buffer.from(`${skan.zrodlo}/${skan.nazwa}`).toString('base64url'), { odcisk: odcisk(skan.stat), stan: 'gotowe', ponowPo: 0 });
  return wynik;
}

export async function rozpoznajSkan(id: string, uzytkownikId: number, uruchom = true) {
  const skan = await odczytaj(id);
  const wynik = await wynikOcr(skan, uruchom);
  if (!wynik) return null;
  const propozycje = dopasujSprawy(wynik.tekst, await sprawyUzytkownika(uzytkownikId));
  return { ...wynik, sha256: skan.sha256, propozycje, propozycjeTerminow: odczytajTerminyOdpowiedzi(wynik.tekst),
    proponowanaSprawaId: propozycje.length === 1 && propozycje[0]!.pewnosc === 'wysoka' ? propozycje[0]!.sprawaId : null };
}

/** Jeden przebieg kolejki. Bez tworzenia spraw, dat, terminów i przypisań. */
export async function przetworzKolejkeSkanow(czyZatrzymano = () => false) {
  const skany = await listaSkanow();
  const ids = new Set(skany.map(s => s.id));
  for (const id of statusy.keys()) if (!ids.has(id)) statusy.delete(id);
  for (const wpis of skany.reverse()) {
    if (czyZatrzymano()) break;
    if (!wpis.gotowy || wpis.zaDuzy || aktywneImporty.has(wpis.id)) continue;
    const stat = await lstat(czesci(wpis.id).sciezka).catch(() => null);
    if (!stat) continue;
    const poprzedni = statusy.get(wpis.id);
    if (poprzedni?.odcisk === odcisk(stat) && (poprzedni.stan === 'gotowe' || poprzedni.ponowPo > Date.now())) continue;
    let skan;
    try { skan = await odczytaj(wpis.id); } catch { continue; }
    statusy.set(wpis.id, { odcisk: odcisk(skan.stat), stan: 'przetwarzanie', ponowPo: 0 });
    try { await wynikOcr(skan, true); }
    catch (blad) {
      statusy.set(wpis.id, { odcisk: odcisk(skan.stat), stan: 'blad', ponowPo: Date.now() + 300_000 });
      // Bez nazw plików i treści dokumentów w dzienniku usługi.
      console.warn('[skany] OCR nie powiódł się; ponowienie za 5 minut.', blad instanceof BladZadania ? blad.kod : 'blad');
    }
  }
}

/** Usunięcie z poczekalni zachowuje plik i metrykę w koszu poza udziałem SMB. */
export async function usunSkan(id: string, uzytkownikId: number, powod: string) {
  if (aktywneImporty.has(id)) throw new BladZadania(409, 'Ten skan jest już przetwarzany');
  aktywneImporty.add(id);
  try {
    const skan = czesci(id);
    if (!await zwyklyFolder(skan.zrodlo)) throw bladBrakZasobu('Katalog skanera nie istnieje');
    const stat = await lstat(skan.sciezka).catch(() => null);
    if (!stat?.isFile() || stat.isSymbolicLink()) throw bladBrakZasobu('Skan nie istnieje');
    if (Date.now() - stat.mtimeMs < 10_000) throw new BladZadania(409, 'Poczekaj na zakończenie odbioru skanu');
    const koszId = randomUUID();
    const folder = path.join(archiwum(), 'kosz', koszId);
    await mkdir(folder, { recursive: true, mode: 0o700 });
    await writeFile(path.join(folder, 'metryka.json'), JSON.stringify({
      nazwa: skan.nazwa, zrodlo: skan.zrodlo, uzytkownikId, powod,
      dataWplywu: (await metadaneSkanu(id, stat))?.dataWplywu ?? null,
      terminOdpowiedzi: (await metadaneSkanu(id, stat))?.terminOdpowiedzi ?? null,
      usunieto: new Date().toISOString(), rozmiarBajtow: stat.size,
    }), { flag: 'wx', mode: 0o600 });
    await rename(skan.sciezka, path.join(folder, skan.nazwa));
    return { przeniesionoDoKosza: true, koszId };
  } finally { aktywneImporty.delete(id); }
}

export async function importujSkan(id: string, uzytkownikId: number, pismoId: number,
  rola: dokumentyDb.RolaDokumentu, oczekiwanyHash?: string) {
  if (aktywneImporty.has(id)) throw new BladZadania(409, 'Ten skan jest już importowany');
  aktywneImporty.add(id);
  try {
    const skan = await odczytaj(id);
    if (oczekiwanyHash && skan.sha256 !== oczekiwanyHash) {
      throw new BladZadania(409, 'Skan zmienił się od rozpoznania. Wykonaj odczyt ponownie.');
    }
    const metadane = await metadaneSkanu(id, skan.stat);
    const pismo = await pismaDb.znajdz(pismoId);
    const terminZeSkanu = rola === 'tresc' && pismo?.kierunek === 'przychodzace' && metadane?.sha256 === skan.sha256 ? metadane.terminOdpowiedzi : null;
    if (terminZeSkanu && pismo?.dataDoreczenia !== metadane?.dataWplywu) {
      throw new BladZadania(409, 'Data doręczenia pisma różni się od daty wpływu skanu. Sprawdź wybrane pismo.');
    }
    const { rows } = await pool.query<{ id: number }>(
      'SELECT id FROM dokument WHERE pismo_id = $1 AND suma_kontrolna = $2 AND rola = $3 LIMIT 1',
      [pismoId, skan.sha256, rola]);
    let dokument = rows[0] ? await dokumentyDb.znajdzDlaUzytkownika(rows[0].id, uzytkownikId) : null;
    if (!dokument) {
      const nowy = await zapiszDokument(pismoId, uzytkownikId, skan.nazwa, skan.plik, rola);
      dokument = await dokumentyDb.znajdzDlaUzytkownika(nowy.id, uzytkownikId);
    }
    if (!dokument) throw new BladZadania(500, 'Nie udało się potwierdzić zapisu dokumentu');
    const ocr = await wynikOcr(skan, false);
    if (ocr) await dokumentyDb.zapiszOcr(dokument.id, ocr.tekst, ocr.liczbaStron);
    const terminId = terminZeSkanu ? await przeniesTerminDoSprawy(pismoId, terminZeSkanu) : null;
    let archiwizowano = false;
    try {
      const aktualny = await odczytaj(id);
      if (aktualny.sha256 === skan.sha256) {
        await mkdir(archiwum(), { recursive: true, mode: 0o700 });
        const archiwalnaNazwa = randomUUID() + path.extname(skan.nazwa).toLowerCase();
        const docelowy = path.join(archiwum(), archiwalnaNazwa);
        await rename(skan.sciezka, docelowy);
        archiwizowano = true;
        await writeFile(docelowy + '.json', JSON.stringify({ nazwa: skan.nazwa, zrodlo: skan.zrodlo,
          dataWplywu: metadane?.dataWplywu ?? null, terminOdpowiedzi: metadane?.terminOdpowiedzi ?? null,
          dokumentId: dokument.id, pismoId, sha256: skan.sha256, zaimportowano: new Date().toISOString() }),
        { flag: 'wx', mode: 0o600 }).catch(() => undefined);
      }
    } catch { /* Dokument jest zapisany; błąd archiwizacji nie może udawać błędu importu. */ }
    const { nazwaWMagazynie: _magazyn, ...publicznyDokument } = dokument;
    return { terminId, dokument: { ...publicznyDokument, ocrGotowy: Boolean(ocr) || dokument.ocrGotowy }, archiwizowano, ostrzezenie: archiwizowano ? null :
      'Dokument zapisano w sprawie. Plik pozostał w poczekalni, ponieważ nie udało się go przenieść do archiwum.' };
  } finally { aktywneImporty.delete(id); }
}
