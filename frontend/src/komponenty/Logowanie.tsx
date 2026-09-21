import { useState, type FormEvent } from 'react';
import { api, token } from '../api/client';
import { Komunikat, Pole } from './wspolne';
import type { Uzytkownik } from '../typy';

/** UC12 — uwierzytelnienie. Bez niego niedostępny jest każdy inny przypadek użycia. */
export function Logowanie({ poZalogowaniu }: { poZalogowaniu: (uzytkownik: Uzytkownik) => void }) {
  const [email, setEmail] = useState('');
  const [haslo, setHaslo] = useState('');
  const [blad, setBlad] = useState<unknown>(null);
  const [trwa, setTrwa] = useState(false);

  async function wyslij(zdarzenie: FormEvent) {
    zdarzenie.preventDefault();
    setBlad(null);
    setTrwa(true);
    try {
      const wynik = await api.wyslij<{ token: string; uzytkownik: Uzytkownik }>('/logowanie', {
        email,
        haslo,
      });
      token.zapisz(wynik.token);
      poZalogowaniu(wynik.uzytkownik);
    } catch (problem) {
      setBlad(problem);
    } finally {
      setTrwa(false);
    }
  }

  return (
    <main className="logowanie">
      <form onSubmit={wyslij} className="karta">
        <h1>Sprawnik</h1>
        <p className="podtytul">
          Rejestr spraw, korespondencji i terminów w postępowaniach administracyjnych
        </p>

        <Komunikat blad={blad} />

        <Pole etykieta="Adres e-mail">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </Pole>

        <Pole etykieta="Hasło">
          <input
            type="password"
            value={haslo}
            onChange={(e) => setHaslo(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Pole>

        <button type="submit" disabled={trwa}>
          {trwa ? 'Sprawdzanie…' : 'Zaloguj się'}
        </button>
      </form>
    </main>
  );
}
