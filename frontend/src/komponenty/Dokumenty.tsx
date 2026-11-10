import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { Data, Komunikat, Pole, Pusto } from './wspolne';
import { nazwyRolDokumentow, type Dokument, type Pismo, type RolaDokumentu, type WynikOcr } from '../typy';
import { Skaner } from './Skaner';

export function Dokumenty({ sprawaId, pisma, poDodaniu, administrator = false }: {
  sprawaId: number; pisma: Pismo[]; poDodaniu: () => Promise<void>; administrator?: boolean;
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
  const aparat = useRef<HTMLInputElement>(null);
  const [rola, setRola] = useState<RolaDokumentu>('tresc');
  const [filtrRoli, setFiltrRoli] = useState('');
  const [wTresci, setWTresci] = useState(false);
  const [ocrZajety, setOcrZajety] = useState<number | null>(null);
  const [ocr, setOcr] = useState<{ nazwa: string; wynik: WynikOcr } | null>(null);

  useEffect(() => {
    let aktualne = true;
    setWczytywanie(true);
    const timer = setTimeout(() => {
      const parametry = new URLSearchParams();
      if (szukaj.trim()) parametry.set('szukaj', szukaj.trim());
      if (filtrPisma) parametry.set('pismoId', filtrPisma);
      if (filtrRoli) parametry.set('rola', filtrRoli);
      if (wTresci) parametry.set('wTresci', 'true');
      api.pobierz<{ dokumenty: Dokument[] }>(`/sprawy/${sprawaId}/dokumenty?${parametry}`)
        .then((wynik) => { if (aktualne) setDokumenty(wynik.dokumenty); })
        .catch((problem) => { if (aktualne) setBlad(problem); })
        .finally(() => { if (aktualne) setWczytywanie(false); });
    }, szukaj ? 250 : 0);
    return () => { aktualne = false; clearTimeout(timer); };
  }, [sprawaId, szukaj, filtrPisma, filtrRoli, wTresci, wersja]);

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
      await api.przeslijPlik(Number(pismoId), plik, rola);
      setKomunikat(`Dołączono dokument „${plik.name}”.`);
      setPlik(null);
      if (polePliku.current) polePliku.current.value = '';
      if (aparat.current) aparat.current.value = '';
      setWersja((value) => value + 1);
      await poDodaniu();
    } catch (problem) { setBlad(problem); }
    finally { setZajety(false); }
  }

  async function odczytajTekst(dokument: Dokument, ponownie = false) {
    setBlad(null); setOcrZajety(dokument.id);
    try {
      const wynik = dokument.ocrGotowy && !ponownie ?
        await api.pobierz<{ ocr: WynikOcr }>(`/dokumenty/${dokument.id}/ocr`) :
        await api.wyslij<{ ocr: WynikOcr }>(`/dokumenty/${dokument.id}/ocr`, {});
      setOcr({ nazwa: dokument.nazwaOryginalna, wynik: wynik.ocr });
      setWersja((value) => value + 1);
    } catch (problem) { setBlad(problem); } finally { setOcrZajety(null); }
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
          <Pole etykieta="Rodzaj dokumentu"><select value={rola} onChange={(e) => setRola(e.target.value as RolaDokumentu)} disabled={zajety}>
            {Object.entries(nazwyRolDokumentow).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></Pole>
          <Pole etykieta="Plik dokumentu (do 10 MiB)">
            <input ref={polePliku} type="file" disabled={zajety}
              onChange={(e) => setPlik(e.target.files?.[0] ?? null)} />
          </Pole>
        </div>
        <input ref={aparat} type="file" accept="image/*" capture="environment" hidden
          onChange={(e) => setPlik(e.target.files?.[0] ?? null)} />
        <div className="filtry">
          <button type="button" className="drugorzedny" disabled={zajety} onClick={() => aparat.current?.click()}>Zrób zdjęcie dokumentu</button>
          {plik && <span className="drobne">Wybrany plik: {plik.name}</span>}
        </div>
        <button type="submit" disabled={zajety || !plik || !pismoId}>
          {zajety ? 'Przesyłanie…' : 'Dołącz dokument'}
        </button>
      </form>}
    {administrator && <Skaner pismoId={pismoId ? Number(pismoId) : null} rola={rola} poDodaniu={async () => {
      setWersja((value) => value + 1); await poDodaniu();
    }} />}
    {ocrZajety !== null && <p role="status">Trwa odczytywanie tekstu OCR. Przy dokumencie wielostronicowym może to potrwać kilka minut.</p>}
    {ocr && <div className="karta formularz">
      <h4>Tekst OCR: {ocr.nazwa}</h4>
      <p className="wskazowka">Sprawdź odczyt z oryginałem, szczególnie daty, kwoty i sygnatury. OCR nie uzupełnia automatycznie terminów ani danych pisma.</p>
      <p className="drobne">Liczba przetworzonych stron: {ocr.wynik.liczbaStron}</p>
      <textarea aria-label="Odczytany tekst OCR" readOnly value={ocr.wynik.tekst} rows={12} style={{ width: '100%' }} />
      <button type="button" className="drugorzedny" onClick={() => setOcr(null)}>Zamknij tekst</button>
    </div>}
    <div className="filtry">
      <input type="search" aria-label="Szukaj dokumentów" placeholder={wTresci ? 'Szukaj po nazwie lub tekście OCR' : 'Szukaj dokumentów po nazwie'}
        value={szukaj} onChange={(e) => setSzukaj(e.target.value)} />
      <select aria-label="Filtr dokumentów według pisma" value={filtrPisma} onChange={(e) => setFiltrPisma(e.target.value)}>
        <option value="">Wszystkie pisma</option>
        {pisma.map((pismo) => <option key={pismo.id} value={pismo.id}>{pismo.rodzaj} — {pismo.korespondent}</option>)}
      </select>
      <select aria-label="Rodzaj dokumentu w filtrze" value={filtrRoli} onChange={(e) => setFiltrRoli(e.target.value)}>
        <option value="">Wszystkie rodzaje dokumentów</option>
        {Object.entries(nazwyRolDokumentow).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label><input type="checkbox" checked={wTresci} onChange={(e) => setWTresci(e.target.checked)} /> Szukaj także w tekście OCR</label>
    </div>
    {wczytywanie ? <p>Wczytywanie dokumentów…</p> : dokumenty.length === 0 ?
      <Pusto tresc="Brak dokumentów spełniających warunki." /> :
      <table><thead><tr><th>Dokument</th><th>Pismo</th><th>Rozmiar</th><th>Dodano</th><th /></tr></thead>
        <tbody>{dokumenty.map((dokument) => <tr key={dokument.id}>
          <td>{dokument.nazwaOryginalna}<div className="drobne">{nazwyRolDokumentow[dokument.rola]}</div></td>
          <td>{pisma.find((pismo) => pismo.id === dokument.pismoId)?.rodzaj ?? '—'}</td>
          <td>{dokument.rozmiarBajtow.toLocaleString('pl-PL')} B</td>
          <td><Data wartosc={dokument.dodano.slice(0, 10)} /></td>
          <td><div className="akcje-dokumentu">
            <button className="drugorzedny" onClick={() => pobierz(dokument)}>Pobierz</button>
            <button className="drugorzedny" disabled={ocrZajety !== null} onClick={() => odczytajTekst(dokument)}>
              {dokument.ocrGotowy ? 'Pokaż tekst OCR' : 'Odczytaj tekst OCR'}
            </button>
            {dokument.ocrGotowy && <button className="drugorzedny" disabled={ocrZajety !== null}
              onClick={() => odczytajTekst(dokument, true)}>Ponów OCR</button>}
          </div></td>
        </tr>)}</tbody>
      </table>}
  </section>;
}
