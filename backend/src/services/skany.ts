import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, open, readdir, lstat, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { BladZadania, bladBrakZasobu } from '../middleware/errors.js';
import { LIMIT_PLIKU, zapiszDokument } from './dokumenty.js';
import { odczytajTekstPliku } from './ocr.js';
import { dopasujSprawy } from './dopasowanie.js';
import { sprawyUzytkownika } from '../db/dopasowanie.js';
import { pool } from '../db/pool.js';
import * as dokumentyDb from '../db/dokumenty.js';

const ZRODLA = ['epson', 'kyocera'] as const;
const aktywneImporty = new Set<string>();
const cache = new Map<string, Awaited<ReturnType<typeof odczytajTekstPliku>>>();
const katalog = () => path.resolve(process.env.SCAN_INBOX_DIR ?? path.join(env.uploadDir, '..', 'skany'));
const archiwum = () => path.resolve(process.env.SCAN_ARCHIVE_DIR ?? path.join(katalog(), '..', 'skany-archiwum'));
const hash = (plik: Buffer) => createHash('sha256').update(plik).digest('hex');

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
      skany.push({ id: Buffer.from(`${zrodlo}/${plik.name}`).toString('base64url'),
        nazwa: plik.name, zrodlo, rozmiarBajtow: stat.size, zmieniono: stat.mtime.toISOString(),
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
    return { ...info, plik, sha256: hash(plik) };
  } finally { await uchwyt.close(); }
}

export async function rozpoznajSkan(id: string, uzytkownikId: number) {
  const skan = await odczytaj(id);
  let wynik = cache.get(skan.sha256);
  if (!wynik) {
    wynik = await odczytajTekstPliku(skan.plik);
    if (cache.size >= 30) cache.delete(cache.keys().next().value!);
    cache.set(skan.sha256, wynik);
  }
  const propozycje = dopasujSprawy(wynik.tekst, await sprawyUzytkownika(uzytkownikId));
  return { ...wynik, sha256: skan.sha256, propozycje,
    proponowanaSprawaId: propozycje.length === 1 && propozycje[0]!.pewnosc === 'wysoka' ? propozycje[0]!.sprawaId : null };
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
    const { rows } = await pool.query<{ id: number }>(
      'SELECT id FROM dokument WHERE pismo_id = $1 AND suma_kontrolna = $2 AND rola = $3 LIMIT 1',
      [pismoId, skan.sha256, rola]);
    let dokument = rows[0] ? await dokumentyDb.znajdzDlaUzytkownika(rows[0].id, uzytkownikId) : null;
    if (!dokument) {
      const nowy = await zapiszDokument(pismoId, uzytkownikId, skan.nazwa, skan.plik, rola);
      dokument = await dokumentyDb.znajdzDlaUzytkownika(nowy.id, uzytkownikId);
    }
    if (!dokument) throw new BladZadania(500, 'Nie udało się potwierdzić zapisu dokumentu');
    const ocr = cache.get(skan.sha256);
    if (ocr) await dokumentyDb.zapiszOcr(dokument.id, ocr.tekst, ocr.liczbaStron);
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
          dokumentId: dokument.id, pismoId, sha256: skan.sha256, zaimportowano: new Date().toISOString() }),
        { flag: 'wx', mode: 0o600 }).catch(() => undefined);
      }
    } catch { /* Dokument jest zapisany; błąd archiwizacji nie może udawać błędu importu. */ }
    const { nazwaWMagazynie: _magazyn, ...publicznyDokument } = dokument;
    return { dokument: { ...publicznyDokument, ocrGotowy: Boolean(ocr) || dokument.ocrGotowy }, archiwizowano, ostrzezenie: archiwizowano ? null :
      'Dokument zapisano w sprawie. Plik pozostał w poczekalni, ponieważ nie udało się go przenieść do archiwum.' };
  } finally { aktywneImporty.delete(id); }
}
