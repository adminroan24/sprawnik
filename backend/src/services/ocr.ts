import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BladZadania } from '../middleware/errors.js';
import * as dokumentyDb from '../db/dokumenty.js';
import { odczytajPlik } from './dokumenty.js';

const wykonaj = promisify(execFile);
let zajety = false;

async function tekstProgramu(program: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await wykonaj(program, args, {
      timeout: 90_000, killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024, encoding: 'utf8',
      env: { ...process.env, LC_ALL: 'C', OMP_THREAD_LIMIT: '2' },
    });
    return stdout;
  } catch (blad) {
    if ((blad as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new BladZadania(503, `OCR wymaga lokalnego programu ${program}`);
    }
    throw new BladZadania(422, 'Nie udało się odczytać dokumentu. Sprawdź format, czytelność i zabezpieczenia pliku.');
  }
}

function typPliku(plik: Buffer): 'pdf' | 'obraz' {
  if (plik.subarray(0, 5).toString() === '%PDF-') return 'pdf';
  if (plik.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      (plik[0] === 255 && plik[1] === 216 && plik[2] === 255)) return 'obraz';
  throw new BladZadania(415, 'OCR obsługuje skany PDF oraz obrazy PNG i JPEG');
}

/** Lokalny OCR. Treść dokumentów nie jest przekazywana do usług zewnętrznych. */
export async function rozpoznajDokument(dokument: dokumentyDb.Dokument & { nazwaWMagazynie: string }) {
  if (zajety) throw new BladZadania(409, 'Trwa rozpoznawanie innego dokumentu. Spróbuj ponownie po jego zakończeniu.');
  zajety = true;
  let katalog: string | undefined;
  try {
    const plik = await odczytajPlik(dokument);
    const typ = typPliku(plik);
    katalog = await mkdtemp(path.join(tmpdir(), 'sprawnik-ocr-'));
    const wejscie = path.join(katalog, typ === 'pdf' ? 'wejscie.pdf' : 'wejscie');
    await writeFile(wejscie, plik, { mode: 0o600 });
    let obrazy = [wejscie];
    if (typ === 'pdf') {
      const info = await tekstProgramu('pdfinfo', [wejscie]);
      const strony = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
      if (strony < 1) throw new BladZadania(422, 'Nie można ustalić liczby stron PDF');
      if (strony > 20) throw new BladZadania(413, 'OCR obsługuje do 20 stron PDF w jednym dokumencie');
      await tekstProgramu('pdftoppm', ['-r', '200', '-scale-to', '2400', '-gray', '-png', wejscie, path.join(katalog, 'strona')]);
      obrazy = (await readdir(katalog)).filter((name) => /^strona-\d+\.png$/.test(name))
        .sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).map((name) => path.join(katalog!, name));
      if (obrazy.length !== strony) throw new BladZadania(422, 'Nie wszystkie strony PDF zostały odczytane');
    }
    const fragmenty: string[] = [];
    for (const obraz of obrazy) {
      fragmenty.push((await tekstProgramu('tesseract', [obraz, 'stdout', '-l', 'pol+eng', '--psm', '3'])).trim());
    }
    const tekst = fragmenty.join('\n\n').trim();
    if (!tekst) throw new BladZadania(422, 'Nie znaleziono czytelnego tekstu. Spróbuj wyraźniejszego skanu.');
    if (tekst.length > 1_000_000) throw new BladZadania(413, 'Wynik OCR jest zbyt obszerny');
    return await dokumentyDb.zapiszOcr(dokument.id, tekst, obrazy.length);
  } finally {
    if (katalog) await rm(katalog, { recursive: true, force: true });
    zajety = false;
  }
}
