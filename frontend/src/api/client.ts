/**
 * Klient REST API.
 *
 * Ścieżki są względne — w trybie deweloperskim obsługuje je proxy Vite, dzięki
 * czemu interfejs nie zna adresu serwera. Token dołączany jest w jednym miejscu,
 * więc żadne wywołanie nie może go pominąć.
 */

const BASE_URL = '/api';
const KLUCZ_TOKENU = 'sprawnik.token';

export class BladApi extends Error {
  constructor(
    readonly kod: number,
    komunikat: string,
    readonly szczegoly: { pole: string; komunikat: string }[] = [],
  ) {
    super(komunikat);
  }
}

export const token = {
  odczytaj: () => localStorage.getItem(KLUCZ_TOKENU),
  zapisz: (wartosc: string) => localStorage.setItem(KLUCZ_TOKENU, wartosc),
  usun: () => localStorage.removeItem(KLUCZ_TOKENU),
};

async function zadanie<T>(sciezka: string, opcje: RequestInit = {}): Promise<T> {
  const zapisany = token.odczytaj();
  const odpowiedz = await fetch(`${BASE_URL}${sciezka}`, {
    ...opcje,
    headers: {
      'Content-Type': 'application/json',
      ...(zapisany ? { Authorization: `Bearer ${zapisany}` } : {}),
      ...opcje.headers,
    },
  });

  if (!odpowiedz.ok) {
    const tresc = await odpowiedz.json().catch(() => ({ error: 'Brak połączenia z serwerem' }));
    throw new BladApi(odpowiedz.status, tresc.error ?? 'Nieznany błąd', tresc.szczegoly ?? []);
  }

  return odpowiedz.json() as Promise<T>;
}

export const api = {
  pobierz: <T,>(sciezka: string) => zadanie<T>(sciezka),
  wyslij: <T,>(sciezka: string, dane: unknown) =>
    zadanie<T>(sciezka, { method: 'POST', body: JSON.stringify(dane) }),
  zmien: <T,>(sciezka: string, dane: unknown) =>
    zadanie<T>(sciezka, { method: 'PATCH', body: JSON.stringify(dane) }),
};

export type HealthResponse = {
  status: string;
  database: string;
  timestamp: string;
};
