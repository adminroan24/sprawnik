import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { FormularzPisma } from './FormularzPisma';
import { Komunikat, Pole } from './wspolne';
import { nazwyRolDokumentow, type Regula, type RolaDokumentu, type SprawaNaLiscie, type SzczegolySprawy } from '../typy';

type Skan = { id: string; nazwa: string; zrodlo: string; rozmiarBajtow: number; gotowy: boolean; zaDuzy: boolean };
type Rozpoznanie = { tekst: string; sha256: string; proponowanaSprawaId: number | null;
  propozycje: { sprawaId: number; tytul: string; pewnosc: 'wysoka' | 'niska'; powody: string[] }[] };

export function Skany({ otworzSprawe }: { otworzSprawe: (id: number) => void }) {
  const [skany, setSkany] = useState<Skan[]>([]);
  const [sprawy, setSprawy] = useState<SprawaNaLiscie[]>([]);
  const [reguly, setReguly] = useState<Regula[]>([]);
  const [wybrany, setWybrany] = useState<Skan | null>(null);
  const [rozpoznanie, setRozpoznanie] = useState<Rozpoznanie | null>(null);
  const [sprawaId, setSprawaId] = useState('');
  const [szczegoly, setSzczegoly] = useState<SzczegolySprawy | null>(null);
  const [pismoId, setPismoId] = useState('');
  const [nowePismo, setNowePismo] = useState(false);
  const [rola, setRola] = useState<RolaDokumentu>('tresc');
  const [zajety, setZajety] = useState(false);
  const [blad, setBlad] = useState<unknown>(null);
  const [komunikat, setKomunikat] = useState('');
  const wersja = useRef(0);

  async function odswiez() { setSkany((await api.pobierz<{ skany: Skan[] }>('/skany')).skany); }
  useEffect(() => {
    Promise.all([odswiez(), api.pobierz<{ sprawy: SprawaNaLiscie[] }>('/sprawy').then(w => setSprawy(w.sprawy)),
      api.pobierz<{ reguly: Regula[] }>('/reguly').then(w => setReguly(w.reguly))]).catch(setBlad);
  }, []);
  useEffect(() => {
    let aktualne = true;
    setSzczegoly(null); setPismoId(''); setNowePismo(false);
    if (sprawaId) api.pobierz<SzczegolySprawy>(`/sprawy/${sprawaId}`)
      .then(w => { if (aktualne) setSzczegoly(w); }).catch(e => { if (aktualne) setBlad(e); });
    return () => { aktualne = false; };
  }, [sprawaId]);

  function wybierz(skan: Skan) {
    wersja.current++; setWybrany(skan); setRozpoznanie(null); setSprawaId('');
    setBlad(null); setKomunikat('');
  }
  async function rozpoznaj() {
    if (!wybrany) return;
    const numer = wersja.current;
    setZajety(true); setBlad(null);
    try {
      const wynik = await api.wyslij<Rozpoznanie>(`/skany/${wybrany.id}/rozpoznaj`, {});
      if (numer !== wersja.current) return;
      setRozpoznanie(wynik);
      if (wynik.proponowanaSprawaId) setSprawaId(String(wynik.proponowanaSprawaId));
    } catch (e) { setBlad(e); } finally { setZajety(false); }
  }
  async function importuj() {
    if (!wybrany || !pismoId) return;
    setZajety(true); setBlad(null);
    try {
      const wynik = await api.wyslij<{ ostrzezenie: string | null }>(`/skany/${wybrany.id}/import`, {
        pismoId: Number(pismoId), rola, sha256: rozpoznanie?.sha256,
      });
      setKomunikat(wynik.ostrzezenie ?? 'Dokument dodano do pisma, a skan przeniesiono do archiwum.');
      setWybrany(null); setRozpoznanie(null); await odswiez();
    } catch (e) { setBlad(e); } finally { setZajety(false); }
  }

  return <section>
    <div className="naglowek-sekcji"><h1>Skany ze skanerów</h1>
      <button disabled={zajety} onClick={() => odswiez().catch(setBlad)}>Odśwież listę</button></div>
    <p>Wybierz odebrany skan. Odczyt tekstu zaproponuje sprawę na podstawie jej znaku lub znaku wcześniejszego pisma.</p>
    <Komunikat blad={blad} />
    {komunikat && <p role="status">{komunikat} {sprawaId && <button onClick={() => otworzSprawe(Number(sprawaId))}>Otwórz sprawę</button>}</p>}
    {skany.length === 0 && <p>Brak skanów oczekujących na przypisanie.</p>}
    {skany.length > 0 && <div className="karta"><table><thead><tr><th>Plik</th><th>Skaner</th><th>Rozmiar</th><th>Wybór</th></tr></thead>
      <tbody>{skany.map(s => <tr key={s.id}><td>{s.nazwa}</td><td>{s.zrodlo}</td><td>{Math.ceil(s.rozmiarBajtow / 1024)} KB</td>
        <td><button disabled={zajety || !s.gotowy || s.zaDuzy} onClick={() => wybierz(s)}>
          {s.zaDuzy ? 'Przekracza 10 MiB' : !s.gotowy ? 'Trwa odbiór…' : wybrany?.id === s.id ? 'Wybrany' : 'Wybierz'}</button></td></tr>)}</tbody></table></div>}
    {wybrany && <div className="karta formularz"><h2>{wybrany.nazwa}</h2>
      <button disabled={zajety} onClick={rozpoznaj}>{zajety ? 'Przetwarzanie…' : 'Rozpoznaj tekst i sprawę'}</button>
      {rozpoznanie && <>
        <p>{rozpoznanie.proponowanaSprawaId ? 'Znaleziono jedną sprawę ze zgodnym znakiem. Sprawdź wybór przed dodaniem dokumentu.' :
          rozpoznanie.propozycje.length ? 'Wybierz sprawę spośród propozycji lub z listy poniżej.' : 'Brak dopasowania. Wybierz sprawę ręcznie.'}</p>
        {rozpoznanie.propozycje.map(p => <div key={p.sprawaId}>
          <button disabled={zajety} onClick={() => setSprawaId(String(p.sprawaId))}>{p.tytul}</button>
          <p>{p.pewnosc === 'wysoka' ? 'Zgodny znak' : 'Podobna instytucja — słabe dopasowanie'}: {p.powody.join('; ')}</p></div>)}
        <details><summary>Odczytany tekst — porównaj z oryginałem</summary><pre className="tekst-ocr">{rozpoznanie.tekst || 'Nie odczytano tekstu.'}</pre></details>
      </>}
      {sprawy.length === 0 ? <p>Najpierw utwórz swoją sprawę w zakładce Sprawy.</p> : <Pole etykieta="Sprawa">
        <select disabled={zajety} value={sprawaId} onChange={e => setSprawaId(e.target.value)}><option value="">Wybierz sprawę</option>
          {sprawy.map(s => <option key={s.id} value={s.id}>{s.tytul}{s.znakWlasny ? ` — ${s.znakWlasny}` : ''}</option>)}</select></Pole>}
      {szczegoly && <>
        <Pole etykieta="Pismo, do którego dodasz skan"><select disabled={zajety} value={pismoId} onChange={e => setPismoId(e.target.value)}>
          <option value="">Wybierz pismo</option>{szczegoly.pisma.map(p => <option key={p.id} value={p.id}>#{p.id} {p.rodzaj} — {p.korespondent}</option>)}</select></Pole>
        <button disabled={zajety} onClick={() => setNowePismo(!nowePismo)}>{nowePismo ? 'Zamknij formularz pisma' : 'Zarejestruj nowe pismo'}</button>
        <Pole etykieta="Rola dokumentu"><select disabled={zajety} value={rola} onChange={e => setRola(e.target.value as RolaDokumentu)}>
          {Object.entries(nazwyRolDokumentow).map(([id, nazwa]) => <option key={id} value={id}>{nazwa}</option>)}</select></Pole>
        <button disabled={zajety || !pismoId || nowePismo} onClick={importuj}>Potwierdź i dodaj dokument do pisma</button>
      </>}
    </div>}
    {wybrany && szczegoly && nowePismo && <FormularzPisma key={`${wybrany.id}/${sprawaId}`} sprawaId={Number(sprawaId)} pisma={szczegoly.pisma} reguly={reguly}
      poZapisaniu={wynik => { setSzczegoly({ ...szczegoly, pisma: [...szczegoly.pisma, wynik.pismo] }); setPismoId(String(wynik.pismo.id)); setNowePismo(false); }} />}
  </section>;
}
