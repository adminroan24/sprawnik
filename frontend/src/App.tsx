import { useEffect, useState } from 'react';
import { api, token } from './api/client';
import { Logowanie } from './komponenty/Logowanie';
import { ListaSpraw } from './komponenty/ListaSpraw';
import { WidokSprawy } from './komponenty/WidokSprawy';
import { PrzegladTerminow } from './komponenty/PrzegladTerminow';
import { Reguly } from './komponenty/Reguly';
import { FirmaIDrzewo } from './komponenty/FirmaIDrzewo';
import { Skany } from './komponenty/Skany';
import type { Uzytkownik, ProfilFirmy } from './typy';

type Widok = { nazwa: 'sprawy' } | { nazwa: 'sprawa'; id: number } | { nazwa: 'terminy' } | { nazwa: 'reguly' } | { nazwa: 'skany' } | { nazwa: 'firma' };

export function App() {
  const [uzytkownik, setUzytkownik] = useState<Uzytkownik | null>(null);
  const [firma, setFirma] = useState<ProfilFirmy | null>(null);
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

  useEffect(() => {
    if (uzytkownik) api.pobierz<{ firma: ProfilFirmy }>('/firma').then(w => setFirma(w.firma)).catch(() => setFirma(null));
    else setFirma(null);
  }, [uzytkownik]);

  if (sprawdzanie) return <main className="wczytywanie">Wczytywanie…</main>;
  if (!uzytkownik) return <Logowanie poZalogowaniu={setUzytkownik} />;

  return (
    <div className="aplikacja">
      <header className="pasek">
        <span className="marka">Sprawnik{firma && <small className="nazwa-firmy">{firma.nazwa}</small>}</span>
        <nav>
          <button
            className={widok.nazwa === 'terminy' ? 'aktywny' : ''}
            onClick={() => setWidok({ nazwa: 'terminy' })}
          >
            Terminy
          </button>
          <button
            className={widok.nazwa === 'sprawy' || widok.nazwa === 'sprawa' ? 'aktywny' : ''}
            onClick={() => setWidok({ nazwa: 'sprawy' })}
          >
            Sprawy
          </button>
          {uzytkownik.rola === 'administrator' && <button
            className={widok.nazwa === 'skany' ? 'aktywny' : ''}
            onClick={() => setWidok({ nazwa: 'skany' })}>Skany</button>}
          {uzytkownik.rola === 'administrator' && <button
            className={widok.nazwa === 'reguly' ? 'aktywny' : ''}
            onClick={() => setWidok({ nazwa: 'reguly' })}>Reguły</button>}
          {uzytkownik.rola === 'administrator' && <button className={widok.nazwa === 'firma' ? 'aktywny' : ''}
            onClick={() => setWidok({ nazwa: 'firma' })}>Firma i drzewo</button>}
        </nav>
        <div className="konto">
          <span>{uzytkownik.imieNazwisko}</span>
          <button
            className="drugorzedny"
            onClick={() => {
              token.usun();
              setUzytkownik(null);
              setWidok({ nazwa: 'terminy' });
            }}
          >
            Wyloguj
          </button>
        </div>
      </header>

      <main>
        {widok.nazwa === 'firma' && uzytkownik.rola === 'administrator' && <FirmaIDrzewo poZmianieFirmy={setFirma} />}
        {widok.nazwa === 'skany' && uzytkownik.rola === 'administrator' && <Skany otworzSprawe={(id) => setWidok({ nazwa: 'sprawa', id })} />}
        {widok.nazwa === 'reguly' && uzytkownik.rola === 'administrator' && <Reguly />}
        {widok.nazwa === 'terminy' && (
          <PrzegladTerminow otworzSprawe={(id) => setWidok({ nazwa: 'sprawa', id })} />
        )}
        {widok.nazwa === 'sprawy' && (
          <ListaSpraw otworzSkany={uzytkownik.rola === 'administrator' ? () => setWidok({ nazwa: 'skany' }) : undefined} otworzSprawe={(id) => setWidok({ nazwa: 'sprawa', id })} />
        )}
        {widok.nazwa === 'sprawa' && (
          <WidokSprawy id={widok.id} wroc={() => setWidok({ nazwa: 'sprawy' })} administrator={uzytkownik.rola === 'administrator'} />
        )}
      </main>
    </div>
  );
}
