import { useEffect, useState } from 'react';
import { apiGet, type HealthResponse } from './api/client';

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<HealthResponse>('/health')
      .then(setHealth)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main>
      <h1>Sprawnik</h1>
      <p>
        System wspomagania zarządzania korespondencją i terminami
        w postępowaniach administracyjnych.
      </p>

      <h2>Stan systemu</h2>
      {error && <p>Brak połączenia z API: {error}</p>}
      {!error && !health && <p>Sprawdzanie…</p>}
      {health && (
        <ul>
          <li>API: {health.status}</li>
          <li>Baza danych: {health.database}</li>
        </ul>
      )}
    </main>
  );
}
