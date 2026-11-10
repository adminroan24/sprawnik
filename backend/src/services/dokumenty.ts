import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import * as dokumentyDb from '../db/dokumenty.js';
import { BladZadania } from '../middleware/errors.js';

export const LIMIT_PLIKU = 10 * 1024 * 1024;

function sciezka(nazwa: string) {
  // Nazwa pochodzi wyłącznie z generatora, nigdy z nazwy przesłanej przez klienta.
  if (!/^[0-9a-f-]{36}$/.test(nazwa)) throw new BladZadania(500, 'Nieprawidłowy zapis pliku');
  return path.join(env.uploadDir, nazwa);
}

export async function zapiszDokument(pismoId: number, uzytkownikId: number, nazwa: string, plik: Buffer) {
  const nazwaWMagazynie = randomUUID();
  const miejsce = sciezka(nazwaWMagazynie);
  await mkdir(env.uploadDir, { recursive: true, mode: 0o700 });
  await writeFile(miejsce, plik, { flag: 'wx', mode: 0o600 });
  try {
    return await dokumentyDb.dodaj({
      pismoId, uzytkownikId, nazwaOryginalna: nazwa, nazwaWMagazynie,
      rozmiarBajtow: plik.length, sumaKontrolna: createHash('sha256').update(plik).digest('hex'),
    });
  } catch (blad) {
    await unlink(miejsce).catch(() => undefined);
    throw blad;
  }
}

export async function odczytajPlik(dokument: {
  nazwaWMagazynie: string; rozmiarBajtow: number; sumaKontrolna: string;
}) {
  let plik: Buffer;
  try {
    plik = await readFile(sciezka(dokument.nazwaWMagazynie));
  } catch (blad) {
    if ((blad as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new BladZadania(410, 'Plik dokumentu nie jest dostępny w magazynie');
    }
    throw blad;
  }
  if (plik.length !== dokument.rozmiarBajtow ||
      createHash('sha256').update(plik).digest('hex') !== dokument.sumaKontrolna) {
    throw new BladZadania(409, 'Plik nie odpowiada zapisanej sumie kontrolnej');
  }
  return plik;
}
