/** Klient REST API. Ścieżki względne — w trybie deweloperskim obsługuje je proxy Vite. */
const BASE_URL = '/api';

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Błąd żądania ${path}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export type HealthResponse = {
  status: string;
  database: string;
  timestamp: string;
};
