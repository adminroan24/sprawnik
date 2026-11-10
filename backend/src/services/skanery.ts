import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BladZadania } from '../middleware/errors.js';
import { LIMIT_PLIKU } from './dokumenty.js';

const wykonaj = promisify(execFile);
let zajety = false;
export const skanowanieWlaczone = () => process.env.SCANNER_ENABLED === 'true';

export async function listaSkanerow(): Promise<{ id: string; nazwa: string }[]> {
  if (!skanowanieWlaczone()) return [];
  try {
    const { stdout } = await wykonaj('scanimage', ['--formatted-device-list=%d\t%v %m%n'], {
      timeout: 30_000, killSignal: 'SIGKILL', maxBuffer: 256 * 1024, encoding: 'utf8',
    });
    return stdout.split('\n').filter((line) => line.includes('\t')).map((line) => {
      const index = line.indexOf('\t');
      return { id: line.slice(0, index), nazwa: line.slice(index + 1).trim() };
    });
  } catch (blad) {
    if ((blad as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new BladZadania(503, 'Na serwerze nie zainstalowano obsługi skanera SANE');
    }
    throw new BladZadania(503, 'Nie można pobrać listy skanerów. Sprawdź połączenie z urządzeniem.');
  }
}

export async function wykonajSkan(urzadzenie: string, dpi: number): Promise<Buffer> {
  if (!skanowanieWlaczone()) throw new BladZadania(503, 'Skanowanie nie jest włączone dla tej instalacji');
  if (zajety) throw new BladZadania(409, 'Skaner jest zajęty. Zaczekaj na zakończenie skanowania.');
  zajety = true;
  try {
    const skanery = await listaSkanerow();
    if (!skanery.some((skaner) => skaner.id === urzadzenie)) {
      throw new BladZadania(400, 'Wybrany skaner nie jest dostępny. Odśwież listę urządzeń.');
    }
    let plik: Buffer;
    try {
      const wynik = await wykonaj('scanimage', ['--device-name', urzadzenie, '--resolution', String(dpi), '--format=png'], {
        timeout: 120_000, killSignal: 'SIGKILL', maxBuffer: LIMIT_PLIKU, encoding: 'buffer',
      });
      plik = wynik.stdout;
    } catch {
      throw new BladZadania(422, 'Skanowanie nie powiodło się. Sprawdź papier, połączenie i wybraną rozdzielczość.');
    }
    if (!plik.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      throw new BladZadania(422, 'Skaner nie zwrócił poprawnego obrazu PNG');
    }
    return plik;
  } finally { zajety = false; }
}
