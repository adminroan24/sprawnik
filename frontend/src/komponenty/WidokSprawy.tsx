import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { FormularzPisma } from './FormularzPisma';
import { sciezkaGrupy } from './grupy';
import type { GrupaSpraw } from '../typy';
import { Dokumenty } from './Dokumenty';
import {
  Data,
  Komunikat,
  Pusto,
  ZnacznikStanu,
  nazwaStatusuSprawy,
  nazwaStatusuTerminu,
} from './wspolne';
import type { Pismo, Regula, SzczegolySprawy, Termin, StatusSprawy } from '../typy';
import { nazwyKanalow, type KanalPisma } from '../typy';

/** UC2 i UC11 — sprawa wraz z korespondencją, terminami i chronologią. */
export function WidokSprawy({ id, wroc, administrator = false }: { id: number; wroc: () => void; administrator?: boolean }) {
  const [dane, setDane] = useState<SzczegolySprawy | null>(null);
  const [grupy, setGrupy] = useState<GrupaSpraw[]>([]);
  const [grupaId, setGrupaId] = useState('');
  const [zapisGrupy, setZapisGrupy] = useState(false);
  const [reguly, setReguly] = useState<Regula[]>([]);
  const [blad, setBlad] = useState<unknown>(null);
  const [formularzWidoczny, setFormularzWidoczny] = useState(false);
  const [wynikRejestracji, setWynikRejestracji] = useState<string | null>(null);
  const [zmianaStatusu, setZmianaStatusu] = useState(false);
  const [odpowiedzNa, setOdpowiedzNa] = useState<Pismo | null>(null);

  async function wczytaj() {
    try {
      const [szczegoly, listaRegul, listaGrup] = await Promise.all([
        api.pobierz<SzczegolySprawy>(`/sprawy/${id}`),
        api.pobierz<{ reguly: Regula[] }>('/reguly'),
        api.pobierz<{ grupy: GrupaSpraw[] }>('/grupy'),
      ]);
      setDane(szczegoly);
      setReguly(listaRegul.reguly); setGrupy(listaGrup.grupy); setGrupaId(szczegoly.sprawa.grupaId ? String(szczegoly.sprawa.grupaId) : '');
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
        <button onClick={() => { setOdpowiedzNa(null); setFormularzWidoczny((widoczny) => !widoczny); }}>
          {formularzWidoczny ? 'Anuluj' : 'Zarejestruj pismo'}
        </button>
      </header>

      <Komunikat blad={blad} />

      <form className="filtry" onSubmit={async e => {
        e.preventDefault(); setZapisGrupy(true); setBlad(null);
        try { await api.zmien(`/sprawy/${id}`, { grupaId: grupaId ? Number(grupaId) : null }); await wczytaj(); }
        catch (problem) { setBlad(problem); } finally { setZapisGrupy(false); }
      }}><label>Grupa sprawy <select disabled={zapisGrupy} value={grupaId} onChange={e => setGrupaId(e.target.value)}>
        <option value="">Bez przypisanej grupy</option>{grupy.map(g => <option key={g.id} value={g.id}>{sciezkaGrupy(grupy, g.id)}</option>)}
      </select></label><button disabled={zapisGrupy || grupaId === (sprawa.grupaId ? String(sprawa.grupaId) : '')}>Zapisz grupę sprawy</button></form>
      <label className="filtry">Stan sprawy
        <select value={sprawa.status} disabled={zmianaStatusu} onChange={async (e) => {
          const status = e.target.value as StatusSprawy;
          setZmianaStatusu(true);
          try { await api.zmien(`/sprawy/${id}`, { status }); await wczytaj(); }
          catch (problem) { setBlad(problem); }
          finally { setZmianaStatusu(false); }
        }}>
          <option value="w_toku">W toku</option>
          <option value="zawieszona">Zawieszona</option>
          <option value="zakonczona">Zakończona</option>
        </select>
      </label>

      {wynikRejestracji && <div className="komunikat informacja">{wynikRejestracji}</div>}

      {formularzWidoczny && (
        <FormularzPisma
          key={odpowiedzNa?.id ?? 'nowe'}
          sprawaId={id}
          reguly={reguly}
          pisma={pisma}
          odpowiedzNa={odpowiedzNa}
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
              <th />
            </tr>
          </thead>
          <tbody>
            {pisma.map((pismo) => (
              <tr key={pismo.id}>
                <td>{pismo.kierunek === 'przychodzace' ? 'przychodzące' : 'wychodzące'}
                  <div className="drobne">{pismo.dataDoreczenia ? 'Doręczone' :
                    pismo.kierunek === 'wychodzace' ? (pismo.dataNadania ? 'Wysłane — oczekuje na doręczenie' : 'Przygotowywane') : 'Zarejestrowane'}</div>
                </td>
                <td>{pismo.rodzaj}
                  {pismo.odpowiedzNaPismoId && <div className="drobne">Odpowiedź na #{pismo.odpowiedzNaPismoId}: {pisma.find((p) => p.id === pismo.odpowiedzNaPismoId)?.rodzaj}</div>}
                </td>
                <td>{pismo.korespondent}</td>
                <td>{pismo.znakPisma ?? <span className="brak">—</span>}
                  {pismo.kanal && <div className="drobne">{nazwyKanalow[pismo.kanal]}</div>}
                  {pismo.numerNadania && <div className="drobne">Nadanie: {pismo.numerNadania}</div>}
                </td>
                <td>
                  {pismo.kierunek === 'wychodzace' && !pismo.dataNadania ?
                    <PotwierdzenieNadania pismo={pismo} reguly={reguly} poZapisaniu={wczytaj} /> :
                    <Data wartosc={pismo.dataNadania} />}
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
                <td><button className="drugorzedny" onClick={() => {
                  setOdpowiedzNa(pismo); setFormularzWidoczny(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}>Zarejestruj odpowiedź</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Dokumenty key={id} sprawaId={id} pisma={pisma} poDodaniu={wczytaj} administrator={administrator} />

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

function PotwierdzenieNadania({ pismo, reguly, poZapisaniu }: {
  pismo: Pismo; reguly: Regula[]; poZapisaniu: () => Promise<void>;
}) {
  const [otwarte, setOtwarte] = useState(false);
  const [data, setData] = useState('');
  const [kanal, setKanal] = useState<KanalPisma | ''>(pismo.kanal ?? '');
  const [numer, setNumer] = useState(pismo.numerNadania ?? '');
  const [regula, setRegula] = useState('');
  const [blad, setBlad] = useState<unknown>(null);
  const [zapis, setZapis] = useState(false);
  if (!otwarte) return <button className="drugorzedny" onClick={() => setOtwarte(true)}>Potwierdź nadanie</button>;
  return <form className="doreczenie" onSubmit={async (e) => {
    e.preventDefault(); setZapis(true); setBlad(null);
    try {
      await api.zmien(`/pisma/${pismo.id}/nadanie`, { dataNadania: data, kanal: kanal || null,
        numerNadania: numer || null, regulaId: regula ? Number(regula) : null });
      setOtwarte(false); await poZapisaniu();
    } catch (problem) { setBlad(problem); } finally { setZapis(false); }
  }}>
    <Komunikat blad={blad} />
    <input aria-label="Data nadania" type="date" required value={data} onChange={(e) => setData(e.target.value)} />
    <select aria-label="Kanał nadania" value={kanal} onChange={(e) => setKanal(e.target.value as KanalPisma | '')}>
      <option value="">Kanał nieokreślony</option>
      {Object.entries(nazwyKanalow).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
    <input aria-label="Numer nadania" placeholder="Numer nadania" value={numer} onChange={(e) => setNumer(e.target.value)} />
    <select aria-label="Reguła od nadania" value={regula} onChange={(e) => setRegula(e.target.value)}>
      <option value="">Bez terminu od nadania</option>
      {reguly.filter((r) => r.zdarzeniePoczatkowe === 'nadanie').map((r) => <option key={r.id} value={r.id}>{r.nazwa}</option>)}
    </select>
    <button type="submit" disabled={zapis}>{zapis ? 'Zapisywanie…' : 'Zapisz nadanie'}</button>
    <button type="button" className="drugorzedny" onClick={() => setOtwarte(false)}>Anuluj</button>
  </form>;
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
