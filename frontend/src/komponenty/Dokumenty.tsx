import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { Data, Komunikat, Pole, Pusto } from './wspolne';
import type { Dokument, Pismo } from '../typy';

export function Dokumenty({ sprawaId, pisma, poDodaniu }: {
  sprawaId: number; pisma: Pismo[]; poDodaniu: () => Promise<void>;
}) {
  const [dokumenty, setDokumenty] = useState<Dokument[]>([]);
  const [szukaj, setSzukaj] = useState('');
  const [filtrPisma, setFiltrPisma] = useState('');
  const [pismoId, setPismoId] = useState('');
  const [plik, setPlik] = useState<File | null>(null);
  const [wersja, setWersja] = useState(0);
  const [zajety, setZajety] = useState(false);
  const [blad, setBlad] = useState<unknown>(null);
  const [komunikat, setKomunikat] = useState('');
  const [wczytywanie, setWczytywanie] = useState(true);
  const polePliku = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let aktualne = true;
    setWczytywanie(true);
    const timer = setTimeout(() => {
      const parametry = new URLSearchParams();
      if (szukaj.trim()) parametry.set('szukaj', szukaj.trim());
      if (filtrPisma) parametry.set('pismoId', filtrPisma);
      api.pobierz<{ dokumenty: Dokument[] }>(`/sprawy/${sprawaId}/dokumenty?${parametry}`)
        .then((wynik) => { if (aktualne) setDokumenty(wynik.dokumenty); })
        .catch((problem) => { if (aktualne) setBlad(problem); })
        .finally(() => { if (aktualne) setWczytywanie(false); });
    }, szukaj ? 250 : 0);
    return () => { aktualne = false; clearTimeout(timer); };
  }, [sprawaId, szukaj, filtrPisma, wersja]);

  async function przeslij(zdarzenie: FormEvent) {
    zdarzenie.preventDefault();
    setBlad(null);
    setKomunikat('');
    if (!plik || !pismoId) return;
    if (plik.size === 0 || plik.size > 10 * 1024 * 1024) {
      setBlad(new Error('Wybierz niepusty plik o rozmiarze do 10 MiB.'));
      return;
    }
    setZajety(true);
    try {
      await api.przeslijPlik(Number(pismoId), plik);
      setKomunikat(`Dołączono dokument „${plik.name}”.`);
      setPlik(null);
      if (polePliku.current) polePliku.current.value = '';
      setWersja((value) => value + 1);
      await poDodaniu();
    } catch (problem) { setBlad(problem); }
    finally { setZajety(false); }
  }

  async function pobierz(dokument: Dokument) {
    setBlad(null);
    try {
      const blob = await api.pobierzPlik(dokument.id);
      const adres = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = adres;
      link.download = dokument.nazwaOryginalna;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(adres), 1000);
    } catch (problem) { setBlad(problem); }
  }

  return <section>
    <h3>Dokumenty</h3>
    <Komunikat blad={blad} />
    {komunikat && <div className="komunikat informacja" role="status">{komunikat}</div>}
    {pisma.length === 0 ? <Pusto tresc="Zarejestruj pismo, aby dołączyć do niego dokumenty." /> :
      <form onSubmit={przeslij} className="karta formularz">
        <div className="siatka">
          <Pole etykieta="Pismo, do którego dołączasz dokument">
            <select value={pismoId} onChange={(e) => setPismoId(e.target.value)} required disabled={zajety}>
              <option value="">Wybierz pismo</option>
              {pisma.map((pismo) => <option key={pismo.id} value={pismo.id}>
                {pismo.rodzaj} — {pismo.korespondent}{pismo.znakPisma ? ` (${pismo.znakPisma})` : ''}
              </option>)}
            </select>
          </Pole>
          <Pole etykieta="Plik dokumentu (do 10 MiB)">
            <input ref={polePliku} type="file" required disabled={zajety}
              onChange={(e) => setPlik(e.target.files?.[0] ?? null)} />
          </Pole>
        </div>
        <button type="submit" disabled={zajety || !plik || !pismoId}>
          {zajety ? 'Przesyłanie…' : 'Dołącz dokument'}
        </button>
      </form>}
    <div className="filtry">
      <input type="search" aria-label="Szukaj dokumentów po nazwie" placeholder="Szukaj dokumentów po nazwie"
        value={szukaj} onChange={(e) => setSzukaj(e.target.value)} />
      <select aria-label="Filtr dokumentów według pisma" value={filtrPisma} onChange={(e) => setFiltrPisma(e.target.value)}>
        <option value="">Wszystkie pisma</option>
        {pisma.map((pismo) => <option key={pismo.id} value={pismo.id}>{pismo.rodzaj} — {pismo.korespondent}</option>)}
      </select>
    </div>
    {wczytywanie ? <p>Wczytywanie dokumentów…</p> : dokumenty.length === 0 ?
      <Pusto tresc="Brak dokumentów spełniających warunki." /> :
      <table><thead><tr><th>Dokument</th><th>Pismo</th><th>Rozmiar</th><th>Dodano</th><th /></tr></thead>
        <tbody>{dokumenty.map((dokument) => <tr key={dokument.id}>
          <td>{dokument.nazwaOryginalna}</td>
          <td>{pisma.find((pismo) => pismo.id === dokument.pismoId)?.rodzaj ?? '—'}</td>
          <td>{dokument.rozmiarBajtow.toLocaleString('pl-PL')} B</td>
          <td><Data wartosc={dokument.dodano.slice(0, 10)} /></td>
          <td><button className="drugorzedny" onClick={() => pobierz(dokument)}>Pobierz</button></td>
        </tr>)}</tbody>
      </table>}
  </section>;
}
