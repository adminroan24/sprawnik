/**
 * Przygotowanie bazy dla testów tras API.
 *
 * Testy działają na osobnej bazie odtwarzanej z tych samych migracji, co baza
 * właściwa — dzięki temu sprawdzają również to, czy migracje są kompletne,
 * a nie tylko zachowanie kodu.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app.js';
import { pool } from '../db/pool.js';

const KATALOG = path.dirname(fileURLToPath(import.meta.url));
const MIGRACJE = path.resolve(KATALOG, '../../../db/migrations');

// Zabezpieczenie przed uruchomieniem testów na bazie roboczej: zestaw testowy
// kasuje schemat, więc wskazanie niewłaściwej bazy kosztowałoby wszystkie dane.
const adres = process.env.DATABASE_URL ?? '';
if (!/_test(\?|$)/.test(adres)) {
  throw new Error(
    'Testy API wymagają bazy, której nazwa kończy się na _test. ' +
      `Otrzymano: ${adres || '(brak DATABASE_URL)'}`,
  );
}

/** Odtwarza schemat od zera i wykonuje wszystkie migracje po kolei. */
export async function odtworzBaze(): Promise<void> {
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await pool.query('CREATE SCHEMA public');

  const pliki = (await readdir(MIGRACJE)).filter((n) => n.endsWith('.sql')).sort();
  for (const plik of pliki) {
    await pool.query(await readFile(path.join(MIGRACJE, plik), 'utf8'));
  }
}

/** Usuwa dane dziedzinowe, zostawiając konfigurację wczytaną migracją. */
export async function wyczyscDane(): Promise<void> {
  await pool.query('TRUNCATE termin, dokument, pismo, sprawa, uzytkownik RESTART IDENTITY CASCADE');
}

export type Serwer = {
  adres: string;
  zatrzymaj: () => Promise<void>;
};

/** Uruchamia aplikację na porcie przydzielonym przez system. */
export async function uruchomSerwer(): Promise<Serwer> {
  const serwer = createApp().listen(0);
  await new Promise((gotowe) => serwer.once('listening', gotowe));
  const { port } = serwer.address() as AddressInfo;

  return {
    adres: `http://127.0.0.1:${port}`,
    zatrzymaj: () =>
      new Promise<void>((gotowe, blad) =>
        serwer.close((problem) => (problem ? blad(problem) : gotowe())),
      ),
  };
}

export async function zamknijPule(): Promise<void> {
  await pool.end();
}

/** Klient HTTP testów — dokłada token i rozpakowuje odpowiedź. */
export function klient(bazowyAdres: string, token?: string) {
  async function zadanie(metoda: string, sciezka: string, dane?: unknown) {
    const odpowiedz = await fetch(`${bazowyAdres}${sciezka}`, {
      method: metoda,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(dane === undefined ? {} : { body: JSON.stringify(dane) }),
    });
    const tresc = await odpowiedz.json().catch(() => null);
    return { kod: odpowiedz.status, tresc };
  }

  return {
    pobierz: (sciezka: string) => zadanie('GET', sciezka),
    wyslij: (sciezka: string, dane: unknown) => zadanie('POST', sciezka, dane),
    zmien: (sciezka: string, dane: unknown) => zadanie('PATCH', sciezka, dane),
  };
}
