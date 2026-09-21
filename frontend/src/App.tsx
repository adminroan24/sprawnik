import { useEffect, useState } from 'react';
import { api, token } from './api/client';
import { Logowanie } from './komponenty/Logowanie';
import { ListaSpraw } from './komponenty/ListaSpraw';
import { WidokSprawy } from './komponenty/WidokSprawy';
import { PrzegladTerminow } from './komponenty/PrzegladTerminow';
import type { Uzytkownik } from './typy';

type Widok = { nazwa: 'sprawy' } | { nazwa: 'sprawa'; id: number } | { nazwa: 'terminy' };

export function App() {
  const [uzytkownik, setUzytkownik] = useState<Uzytkownik | null>(null);
  const [sprawdzanie, setSprawdzanie] = useState(true);
  const [widok, setWidok] = useState<Widok>({ nazwa: 'terminy' });

  // Token zapamiętany w przeglądarce bywa nieważny — potwierdza go serwer,
  // zanim interfejs pokaże dane.
  useEffect(() => {
    if (!token.odczytaj()) {
      setSprawdzanie(false);
      return;
    }
    api
      .pobierz<{ uzytkownik: Uzytkownik }>('/ja')
      .then((wynik) => setUzytkownik(wynik.uzytkownik))
      .catch(() => token.usun())
      .finally(() => setSprawdzanie(false));
  }, []);

  if (sprawdzanie) return <main className="wczytywanie">Wczytywanie…</main>;
  if (!uzytkownik) return <Logowanie poZalogowaniu={setUzytkownik} />;

  return (
    <div className="aplikacja">
      <header className="pasek">
        <span className="marka">Sprawnik</span>
        <nav>
          <button
            className={widok.nazwa === 'terminy' ? 'aktywny' : ''}
            onClick={() => setWidok({ nazwa: 'terminy' })}
          >
            Terminy
          </button>
          <button
            className={widok.nazwa !== 'terminy' ? 'aktywny' : ''}
            onClick={() => setWidok({ nazwa: 'sprawy' })}
          >
            Sprawy
          </button>
        </nav>
        <div className="konto">
          <span>{uzytkownik.imieNazwisko}</span>
          <button
            className="drugorzedny"
            onClick={() => {
              token.usun();
              setUzytkownik(null);
            }}
          >
            Wyloguj
          </button>
        </div>
      </header>

      <main>
        {widok.nazwa === 'terminy' && (
          <PrzegladTerminow otworzSprawe={(id) => setWidok({ nazwa: 'sprawa', id })} />
        )}
        {widok.nazwa === 'sprawy' && (
          <ListaSpraw otworzSprawe={(id) => setWidok({ nazwa: 'sprawa', id })} />
        )}
        {widok.nazwa === 'sprawa' && (
          <WidokSprawy id={widok.id} wroc={() => setWidok({ nazwa: 'sprawy' })} />
        )}
      </main>
    </div>
  );
}
