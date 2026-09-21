import pg from 'pg';
import { env } from '../config/env.js';

// Domyślne konwersje sterownika są dla tego projektu niewłaściwe w dwóch miejscach.
//
// Kolumny `date` zamieniane są domyślnie na obiekt Date interpretowany w strefie
// lokalnej, co potrafi przesunąć datę dzienną o dobę. Termin jest datą bez godziny,
// więc pozostaje łańcuchem ISO na całej drodze od bazy do interfejsu.
pg.types.setTypeParser(pg.types.builtins.DATE, (wartosc) => wartosc);

// Kolumny `bigint` zwracane są domyślnie jako łańcuch, aby nie stracić precyzji
// przy wartościach większych niż zakres liczby JavaScriptu. Identyfikatory w tym
// systemie takich wartości nie osiągają, a łańcuchy komplikowałyby porównania.
pg.types.setTypeParser(pg.types.builtins.INT8, (wartosc) => Number(wartosc));

export const pool = new pg.Pool({ connectionString: env.databaseUrl });

/** Sprawdza dostępność bazy — wykorzystywane przez endpoint /api/health. */
export async function checkConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Odbiorca zapytań: pula albo pojedyncze połączenie objęte transakcją.
 * Pozwala tym samym funkcjom repozytoriów działać wewnątrz transakcji i poza nią.
 */
export type Wykonawca = Pick<pg.Pool, 'query'>;

/**
 * Wykonuje operacje w jednej transakcji. Zapis pisma wraz z wyznaczonym
 * terminem musi być niepodzielny — pismo bez terminu, który miał z niego
 * powstać, byłoby danymi wprowadzającymi w błąd.
 */
export async function wTransakcji<T>(operacje: (wykonawca: Wykonawca) => Promise<T>): Promise<T> {
  const polaczenie = await pool.connect();
  try {
    await polaczenie.query('BEGIN');
    const wynik = await operacje(polaczenie);
    await polaczenie.query('COMMIT');
    return wynik;
  } catch (blad) {
    await polaczenie.query('ROLLBACK');
    throw blad;
  } finally {
    polaczenie.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
