import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { Data, Komunikat, Pole, Pusto, nazwaStatusuSprawy } from './wspolne';
import { DrzewoSpraw } from './DrzewoSpraw';
import { sciezkaGrupy } from './grupy';
import type { SprawaNaLiscie, StatusSprawy, GrupaSpraw } from '../typy';

/** UC1 i UC10 — rejestr spraw wraz z wyszukiwaniem i filtrowaniem. */
export function ListaSpraw({ otworzSprawe, otworzSkany }: { otworzSprawe: (id: number) => void; otworzSkany?: () => void }) {
  const [grupy, setGrupy] = useState<GrupaSpraw[]>([]);
  const [wybranaGrupa, setWybranaGrupa] = useState('');
  const [sprawy, setSprawy] = useState<SprawaNaLiscie[]>([]);
  const [szukaj, setSzukaj] = useState('');
  const [status, setStatus] = useState<StatusSprawy | ''>('');
  const [blad, setBlad] = useState<unknown>(null);
  const [formularzWidoczny, setFormularzWidoczny] = useState(false);

  async function wczytaj() {
    try {
      const parametry = new URLSearchParams();
      if (szukaj.trim()) parametry.set('szukaj', szukaj.trim());
      if (wybranaGrupa === 'bez') parametry.set('nieprzypisane', 'true');
      else if (wybranaGrupa) parametry.set('grupaId', wybranaGrupa);
      if (status) parametry.set('status', status);
      const wynik = await api.pobierz<{ sprawy: SprawaNaLiscie[] }>(`/sprawy?${parametry}`);
      setSprawy(wynik.sprawy);
      setBlad(null);
    } catch (problem) {
      setBlad(problem);
    }
  }

  // Wyszukiwanie odpytuje serwer z opóźnieniem, żeby nie wysyłać żądania
  // po każdym naciśnięciu klawisza.
  useEffect(() => {
    const licznik = setTimeout(wczytaj, szukaj ? 250 : 0);
    return () => clearTimeout(licznik);
  }, [szukaj, status, wybranaGrupa]);
  useEffect(() => { api.pobierz<{ grupy: GrupaSpraw[] }>('/grupy').then(w => setGrupy(w.grupy)).catch(setBlad); }, []);

  return (
    <section>
      <header className="naglowek-sekcji">
        <h2>Sprawy</h2>
        <button onClick={() => setFormularzWidoczny((widoczny) => !widoczny)}>
          {formularzWidoczny ? 'Anuluj' : 'Nowa sprawa'}
        </button>
      </header>

      {formularzWidoczny && (
        <FormularzSprawy grupy={grupy} domyslnaGrupa={/^\d+$/.test(wybranaGrupa) ? wybranaGrupa : ''}
          poZapisaniu={(id) => {
            setFormularzWidoczny(false);
            otworzSprawe(id);
          }}
        />
      )}

      <div className="uklad-drzewa"><aside className="karta">
        <h3>Drzewo spraw</h3>{otworzSkany && <button onClick={otworzSkany}>Skany do posegregowania</button>}
        <DrzewoSpraw grupy={grupy} wybrana={wybranaGrupa} wybierz={id => { setWybranaGrupa(id); setStatus(''); }} />
        <button onClick={() => { setWybranaGrupa(''); setStatus('zakonczona'); }}>Archiwum — zakończone sprawy</button>
      </aside><div>
      <div className="filtry">
        <input
          type="search"
          placeholder="Szukaj po tytule, znaku lub organie"
          value={szukaj}
          onChange={(e) => setSzukaj(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusSprawy | '')}>
          <option value="">Wszystkie stany</option>
          <option value="w_toku">W toku</option>
          <option value="zawieszona">Zawieszone</option>
          <option value="zakonczona">Zakończone</option>
        </select>
      </div>

      <Komunikat blad={blad} />

      {sprawy.length === 0 ? (
        <Pusto tresc="Brak spraw spełniających warunki." />
      ) : (
        <table>
          <thead>
            <tr>
              <th>Sprawa</th>
              <th>Grupa</th><th>Organ</th>
              <th>Stan</th>
              <th>Pisma</th>
              <th>Terminy otwarte</th>
              <th>Najbliższy termin</th>
            </tr>
          </thead>
          <tbody>
            {sprawy.map((sprawa) => (
              <tr key={sprawa.id} onClick={() => otworzSprawe(sprawa.id)} className="klikalny">
                <td>
                  <strong>{sprawa.tytul}</strong>
                  {sprawa.znakWlasny && <div className="drobne">znak: {sprawa.znakWlasny}</div>}
                </td>
                <td>{sciezkaGrupy(grupy, sprawa.grupaId) || 'Bez przypisanej grupy'}</td>
                <td>{sprawa.organ ?? <span className="brak">—</span>}</td>
                <td>{nazwaStatusuSprawy(sprawa.status)}</td>
                <td className="liczba">{sprawa.liczbaPism}</td>
                <td className="liczba">{sprawa.liczbaTerminowOtwartych}</td>
                <td>
                  <Data wartosc={sprawa.najblizszyTermin} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </div></div>
    </section>
  );
}

function FormularzSprawy({ poZapisaniu, grupy, domyslnaGrupa }: { poZapisaniu: (id: number) => void; grupy: GrupaSpraw[]; domyslnaGrupa: string }) {
  const [grupaId, setGrupaId] = useState(domyslnaGrupa);
  const [tytul, setTytul] = useState('');
  const [organ, setOrgan] = useState('');
  const [znakWlasny, setZnakWlasny] = useState('');
  const [dataWszczecia, setDataWszczecia] = useState('');
  const [opis, setOpis] = useState('');
  const [blad, setBlad] = useState<unknown>(null);

  async function wyslij(zdarzenie: FormEvent) {
    zdarzenie.preventDefault();
    try {
      const wynik = await api.wyslij<{ sprawa: { id: number } }>('/sprawy', {
        tytul, grupaId: grupaId ? Number(grupaId) : null,
        organ,
        znakWlasny,
        dataWszczecia: dataWszczecia || null,
        opis,
      });
      poZapisaniu(wynik.sprawa.id);
    } catch (problem) {
      setBlad(problem);
    }
  }

  return (
    <form onSubmit={wyslij} className="karta formularz">
      <h3>Rejestracja sprawy</h3>
      <Komunikat blad={blad} />
      <div className="siatka">
        <Pole etykieta="Tytuł sprawy">
          <input value={tytul} onChange={(e) => setTytul(e.target.value)} required />
        </Pole>
        <Pole etykieta="Organ prowadzący">
          <input value={organ} onChange={(e) => setOrgan(e.target.value)} />
        </Pole>
        <Pole etykieta="Znak własny">
          <input value={znakWlasny} onChange={(e) => setZnakWlasny(e.target.value)} />
        </Pole>
        <Pole etykieta="Data wszczęcia">
          <input
            type="date"
            value={dataWszczecia}
            onChange={(e) => setDataWszczecia(e.target.value)}
          />
        </Pole>
      </div>
      <Pole etykieta="Grupa sprawy"><select value={grupaId} onChange={e => setGrupaId(e.target.value)}><option value="">Bez przypisanej grupy</option>
        {grupy.map(g => <option key={g.id} value={g.id}>{sciezkaGrupy(grupy, g.id)}</option>)}</select></Pole>
      <Pole etykieta="Opis">
        <textarea value={opis} onChange={(e) => setOpis(e.target.value)} rows={2} />
      </Pole>
      <button type="submit">Zapisz sprawę</button>
    </form>
  );
}
