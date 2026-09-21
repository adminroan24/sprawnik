import { pool } from './pool.js';
import type { Kalendarz } from '../services/terminy.js';

/**
 * Wczytuje kalendarz dni ustawowo wolnych do zbioru dat ISO.
 *
 * Tabela liczy kilkadziesiąt wierszy i zmienia się raz na rok, więc odczytywana
 * jest raz i trzymana w pamięci procesu. Bez tego każde wyznaczenie terminu
 * odpytywałoby bazę w pętli przesuwania dnia końcowego.
 */
let zbior: Kalendarz | null = null;

export async function wczytajKalendarz(): Promise<Kalendarz> {
  if (zbior) return zbior;
  const { rows } = await pool.query<{ data: string }>('SELECT data FROM dzien_wolny');
  zbior = new Set(rows.map((wiersz) => wiersz.data));
  return zbior;
}

/** Unieważnia kopię w pamięci — wywoływane po zmianie kalendarza w bazie. */
export function uniewaznijKalendarz(): void {
  zbior = null;
}

export async function listaDniWolnych(rok: number): Promise<{ data: string; nazwa: string }[]> {
  const { rows } = await pool.query<{ data: string; nazwa: string }>(
    `SELECT data, nazwa FROM dzien_wolny
      WHERE extract(year FROM data) = $1
      ORDER BY data`,
    [rok],
  );
  return rows;
}
