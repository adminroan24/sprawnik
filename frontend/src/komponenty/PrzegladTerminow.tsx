import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Data, Komunikat, Pusto, ZnacznikStanu } from './wspolne';
import type { StanTerminu, Termin } from '../typy';

type Odpowiedz = {
  terminy: Termin[];
  podsumowanie: Record<StanTerminu, number>;
  dzien: string;
};

/**
 * UC8 i UC9 — przegląd terminów ze wszystkich spraw wraz z ostrzeganiem.
 *
 * Stany przychodzą z serwera wyliczone na dzień dzisiejszy. Ostrzeżenie nie
 * zmienia terminu — zmienia wyłącznie sposób jego prezentacji.
 */
export function PrzegladTerminow({ otworzSprawe }: { otworzSprawe: (id: number) => void }) {
  const [dane, setDane] = useState<Odpowiedz | null>(null);
  const [status, setStatus] = useState('otwarty');
  const [prog, setProg] = useState(7);
  const [blad, setBlad] = useState<unknown>(null);

  useEffect(() => {
    api
      .pobierz<Odpowiedz>(`/terminy?status=${status}&progOstrzegania=${prog}`)
      .then(setDane)
      .catch(setBlad);
  }, [status, prog]);

  return (
    <section>
      <header className="naglowek-sekcji">
        <h2>Terminy</h2>
      </header>

      <div className="filtry">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="otwarty">Otwarte</option>
          <option value="wykonany">Wykonane</option>
          <option value="anulowany">Anulowane</option>
          <option value="wszystkie">Wszystkie</option>
        </select>
        <label className="prog">
          Ostrzegaj na
          <input
            type="number"
            min={1}
            max={365}
            value={prog}
            onChange={(e) => setProg(Number(e.target.value))}
          />
          dni przed upływem
        </label>
      </div>

      <Komunikat blad={blad} />

      {dane && (
        <>
          <div className="podsumowanie">
            <div className="kafelek przekroczony">
              <span className="liczba">{dane.podsumowanie.przekroczony}</span>
              <span>przekroczonych</span>
            </div>
            <div className="kafelek zblizajacy_sie">
              <span className="liczba">{dane.podsumowanie.zblizajacy_sie}</span>
              <span>zbliżających się</span>
            </div>
            <div className="kafelek odlegly">
              <span className="liczba">{dane.podsumowanie.odlegly}</span>
              <span>odległych</span>
            </div>
            <p className="drobne">
              stan na dzień <Data wartosc={dane.dzien} />
            </p>
          </div>

          {dane.terminy.length === 0 ? (
            <Pusto tresc="Brak terminów o wybranym stanie." />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Upływa</th>
                  <th>Czynność</th>
                  <th>Sprawa</th>
                  <th>Stan</th>
                  <th>Podstawa</th>
                </tr>
              </thead>
              <tbody>
                {dane.terminy.map((termin) => (
                  <tr
                    key={termin.id}
                    className="klikalny"
                    onClick={() => otworzSprawe(termin.sprawaId)}
                  >
                    <td>
                      <Data wartosc={termin.dataUplywu} />
                    </td>
                    <td>{termin.czynnosc}</td>
                    <td>{termin.tytulSprawy}</td>
                    <td>
                      <ZnacznikStanu stan={termin.stan} dni={termin.dniDoUplywu} />
                    </td>
                    <td className="drobne">
                      {termin.sposobWyznaczenia === 'automatyczny'
                        ? `reguła: ${termin.nazwaReguly ?? '—'}`
                        : 'wprowadzony ręcznie'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}
