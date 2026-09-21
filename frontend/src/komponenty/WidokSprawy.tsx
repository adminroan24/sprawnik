import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { FormularzPisma } from './FormularzPisma';
import {
  Data,
  Komunikat,
  Pusto,
  ZnacznikStanu,
  nazwaStatusuSprawy,
  nazwaStatusuTerminu,
} from './wspolne';
import type { Pismo, Regula, SzczegolySprawy, Termin } from '../typy';

/** UC2 i UC11 — sprawa wraz z korespondencją, terminami i chronologią. */
export function WidokSprawy({ id, wroc }: { id: number; wroc: () => void }) {
  const [dane, setDane] = useState<SzczegolySprawy | null>(null);
  const [reguly, setReguly] = useState<Regula[]>([]);
  const [blad, setBlad] = useState<unknown>(null);
  const [formularzWidoczny, setFormularzWidoczny] = useState(false);
  const [wynikRejestracji, setWynikRejestracji] = useState<string | null>(null);

  async function wczytaj() {
    try {
      const [szczegoly, listaRegul] = await Promise.all([
        api.pobierz<SzczegolySprawy>(`/sprawy/${id}`),
        api.pobierz<{ reguly: Regula[] }>('/reguly'),
      ]);
      setDane(szczegoly);
      setReguly(listaRegul.reguly);
      setBlad(null);
    } catch (problem) {
      setBlad(problem);
    }
  }

  useEffect(() => {
    void wczytaj();
  }, [id]);

  async function zmienStatusTerminu(termin: Termin, status: 'wykonany' | 'anulowany') {
    try {
      await api.zmien(`/terminy/${termin.id}`, { status });
      await wczytaj();
    } catch (problem) {
      setBlad(problem);
    }
  }

  if (blad && !dane) return <Komunikat blad={blad} />;
  if (!dane) return <p className="pusto">Wczytywanie…</p>;

  const { sprawa, pisma, terminy, chronologia } = dane;

  return (
    <section>
      <header className="naglowek-sekcji">
        <div>
          <button className="powrot" onClick={wroc}>
            ← Sprawy
          </button>
          <h2>{sprawa.tytul}</h2>
          <p className="drobne">
            {sprawa.organ ?? 'organ nieokreślony'}
            {sprawa.znakWlasny && ` · znak ${sprawa.znakWlasny}`} ·{' '}
            {nazwaStatusuSprawy(sprawa.status)} · wszczęcie{' '}
            <Data wartosc={sprawa.dataWszczecia} />
          </p>
        </div>
        <button onClick={() => setFormularzWidoczny((widoczny) => !widoczny)}>
          {formularzWidoczny ? 'Anuluj' : 'Zarejestruj pismo'}
        </button>
      </header>

      <Komunikat blad={blad} />

      {wynikRejestracji && <div className="komunikat informacja">{wynikRejestracji}</div>}

      {formularzWidoczny && (
        <FormularzPisma
          sprawaId={id}
          reguly={reguly}
          poZapisaniu={async (wynik) => {
            setFormularzWidoczny(false);
            setWynikRejestracji(
              wynik.termin
                ? `Zarejestrowano pismo. Termin „${wynik.termin.czynnosc}" upływa ${wynik.termin.dataUplywu}.`
                : `Zarejestrowano pismo bez terminu. ${wynik.powodBrakuTerminu ?? ''}`,
            );
            await wczytaj();
          }}
        />
      )}

      <h3>Terminy</h3>
      {terminy.length === 0 ? (
        <Pusto tresc="Żaden termin nie został jeszcze wyznaczony." />
      ) : (
        <table>
          <thead>
            <tr>
              <th>Czynność</th>
              <th>Bieg od</th>
              <th>Upływa</th>
              <th>Stan</th>
              <th>Podstawa</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {terminy.map((termin) => (
              <tr key={termin.id} className={termin.status !== 'otwarty' ? 'zamkniety' : ''}>
                <td>{termin.czynnosc}</td>
                <td>
                  <Data wartosc={termin.dataPoczatkowa} />
                </td>
                <td>
                  <Data wartosc={termin.dataUplywu} />
                </td>
                <td>
                  {termin.status === 'otwarty' ? (
                    <ZnacznikStanu stan={termin.stan} dni={termin.dniDoUplywu} />
                  ) : (
                    nazwaStatusuTerminu(termin.status)
                  )}
                </td>
                <td className="drobne">
                  {termin.sposobWyznaczenia === 'automatyczny'
                    ? `reguła: ${termin.nazwaReguly ?? '—'}`
                    : 'wprowadzony ręcznie'}
                </td>
                <td className="akcje">
                  {termin.status === 'otwarty' && (
                    <>
                      <button onClick={() => zmienStatusTerminu(termin, 'wykonany')}>
                        Wykonany
                      </button>
                      <button
                        className="drugorzedny"
                        onClick={() => zmienStatusTerminu(termin, 'anulowany')}
                      >
                        Anuluj
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Korespondencja</h3>
      {pisma.length === 0 ? (
        <Pusto tresc="Brak zarejestrowanych pism." />
      ) : (
        <table>
          <thead>
            <tr>
              <th>Kierunek</th>
              <th>Rodzaj</th>
              <th>Korespondent</th>
              <th>Znak</th>
              <th>Nadanie</th>
              <th>Doręczenie</th>
            </tr>
          </thead>
          <tbody>
            {pisma.map((pismo) => (
              <tr key={pismo.id}>
                <td>{pismo.kierunek === 'przychodzace' ? 'przychodzące' : 'wychodzące'}</td>
                <td>{pismo.rodzaj}</td>
                <td>{pismo.korespondent}</td>
                <td>{pismo.znakPisma ?? <span className="brak">—</span>}</td>
                <td>
                  <Data wartosc={pismo.dataNadania} />
                </td>
                <td>
                  {pismo.dataDoreczenia ? (
                    <Data wartosc={pismo.dataDoreczenia} />
                  ) : (
                    <PotwierdzenieDoreczenia
                      pismo={pismo}
                      reguly={reguly}
                      poZapisaniu={async () => {
                        await wczytaj();
                      }}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Chronologia sprawy</h3>
      {chronologia.length === 0 ? (
        <Pusto tresc="Brak zdarzeń." />
      ) : (
        <ol className="chronologia">
          {chronologia.map((zdarzenie, indeks) => (
            <li key={`${zdarzenie.data}-${indeks}`} className={zdarzenie.rodzaj}>
              <Data wartosc={zdarzenie.data} />
              <span>{zdarzenie.opis}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * Uzupełnienie daty doręczenia pisma zarejestrowanego wcześniej. Dopiero ta
 * czynność pozwala wyznaczyć termin, dlatego obok daty wskazuje się regułę.
 */
function PotwierdzenieDoreczenia({
  pismo,
  reguly,
  poZapisaniu,
}: {
  pismo: Pismo;
  reguly: Regula[];
  poZapisaniu: () => Promise<void>;
}) {
  const [otwarte, setOtwarte] = useState(false);
  const [data, setData] = useState('');
  const [regulaId, setRegulaId] = useState('');
  const [blad, setBlad] = useState<unknown>(null);

  if (!otwarte) {
    return (
      <button className="drugorzedny" onClick={() => setOtwarte(true)}>
        oczekuje — potwierdź
      </button>
    );
  }

  return (
    <div className="doreczenie">
      <Komunikat blad={blad} />
      <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      <select value={regulaId} onChange={(e) => setRegulaId(e.target.value)}>
        <option value="">Bez terminu</option>
        {reguly.map((regula) => (
          <option key={regula.id} value={regula.id}>
            {regula.nazwa}
          </option>
        ))}
      </select>
      <button
        onClick={async () => {
          try {
            await api.zmien(`/pisma/${pismo.id}/doreczenie`, {
              dataDoreczenia: data,
              regulaId: regulaId ? Number(regulaId) : null,
            });
            setOtwarte(false);
            await poZapisaniu();
          } catch (problem) {
            setBlad(problem);
          }
        }}
      >
        Zapisz
      </button>
    </div>
  );
}
