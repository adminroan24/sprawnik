import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { TerminOdpowiedziSkanu } from './TerminOdpowiedziSkanu';
import type { TerminSkanu, PropozycjaTerminuSkanu } from '../typy';
import { FormularzPisma } from './FormularzPisma';
import { Komunikat, Pole } from './wspolne';
import { nazwyRolDokumentow, type Regula, type RolaDokumentu, type SprawaNaLiscie, type WynikRejestracjiPisma, type SzczegolySprawy } from '../typy';

type Skan = { id: string; nazwa: string; zrodlo: string; rozmiarBajtow: number; gotowy: boolean; zaDuzy: boolean; dataWplywu: string | null; terminOdpowiedzi: TerminSkanu | null };
type Rozpoznanie = { propozycjeTerminow: PropozycjaTerminuSkanu[]; tekst: string; sha256: string; proponowanaSprawaId: number | null;
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
  const [dataWplywu, setDataWplywu] = useState('');
  const [regulaDoreczenia, setRegulaDoreczenia] = useState('');
  const [usuniecie, setUsuniecie] = useState<Skan | null>(null);
  const [powodUsuniecia, setPowodUsuniecia] = useState('');
  const [wynikTerminu, setWynikTerminu] = useState('');
  const [zajety, setZajety] = useState(false);
  const [blad, setBlad] = useState<unknown>(null);
  const [komunikat, setKomunikat] = useState('');
  const wersja = useRef(0);

  const pismo = nowePismo ? null : szczegoly?.pisma.find(p => String(p.id) === pismoId);
  const data = pismo?.dataDoreczenia ?? dataWplywu;
  const wymaganaData = pismo?.kierunek === 'przychodzace' && rola === 'tresc';
  const dzisiaj = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  async function odswiez() { setSkany((await api.pobierz<{ skany: Skan[] }>('/skany')).skany); }
  useEffect(() => {
    Promise.all([odswiez(), api.pobierz<{ sprawy: SprawaNaLiscie[] }>('/sprawy').then(w => setSprawy(w.sprawy)),
      api.pobierz<{ reguly: Regula[] }>('/reguly').then(w => setReguly(w.reguly))]).catch(setBlad);
  }, []);
  useEffect(() => {
    let aktualne = true;
    setSzczegoly(null); setPismoId(''); setNowePismo(false); setRegulaDoreczenia('');
    if (sprawaId) api.pobierz<SzczegolySprawy>(`/sprawy/${sprawaId}`)
      .then(w => { if (aktualne) setSzczegoly(w); }).catch(e => { if (aktualne) setBlad(e); });
    return () => { aktualne = false; };
  }, [sprawaId]);

  function wybierz(skan: Skan) {
    wersja.current++; setWybrany(skan); setRozpoznanie(null); setSprawaId('');
    setBlad(null); setKomunikat(''); setDataWplywu(skan.dataWplywu ?? ''); setRegulaDoreczenia(''); setWynikTerminu('');
  }
  async function zapiszDate() {
    if (!wybrany || !data) return;
    setZajety(true); setBlad(null);
    try {
      const zapis = await api.zmien<{ dataWplywu: string; terminOdpowiedzi: TerminSkanu | null }>(`/skany/${wybrany.id}/wplyw`, {
        dataWplywu: data, sha256: rozpoznanie?.sha256,
      });
      setWybrany(s => s ? { ...s, dataWplywu: zapis.dataWplywu, terminOdpowiedzi: zapis.terminOdpowiedzi } : s);
      setSkany(lista => lista.map(s => s.id === wybrany.id ? { ...s, dataWplywu: zapis.dataWplywu, terminOdpowiedzi: zapis.terminOdpowiedzi } : s));
    } catch (e) { setBlad(e); } finally { setZajety(false); }
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
    if (wymaganaData && !data) { setBlad(new Error('Uzupełnij datę wpływu / doręczenia pisma.')); return; }
    setZajety(true); setBlad(null);
    try {
      if (pismo?.kierunek === 'przychodzace' && !pismo.dataDoreczenia && data) {
        const zapis = await api.zmien<WynikRejestracjiPisma>(`/pisma/${pismo.id}/doreczenie`, {
          dataDoreczenia: data, regulaId: !wybrany.terminOdpowiedzi && regulaDoreczenia ? Number(regulaDoreczenia) : null,
        });
        setSzczegoly(s => s ? { ...s, pisma: s.pisma.map(p => p.id === zapis.pismo.id ? zapis.pismo : p) } : s);
        setWynikTerminu(wybrany.terminOdpowiedzi ? 'Data doręczenia zapisana. Termin ze skanu zostanie dodany podczas importu dokumentu.' : zapis.termin ? `Termin: ${zapis.termin.czynnosc} — ${zapis.termin.dataUplywu.split('-').reverse().join('.')}.` : 'Data zapisana. Nie wyznaczono terminu — brak wybranej reguły.');
      }
      const wynik = await api.wyslij<{ ostrzezenie: string | null; terminId: number | null }>(`/skany/${wybrany.id}/import`, {
        pismoId: Number(pismoId), rola, sha256: rozpoznanie?.sha256,
      });
      if (wynik.terminId && wybrany.terminOdpowiedzi) setWynikTerminu(`Termin odpowiedzi / wykonania zapisano w sprawie: ${wybrany.terminOdpowiedzi.dataUplywu.split('-').reverse().join('.')}.`);
      setKomunikat(wynik.ostrzezenie ?? 'Dokument dodano do pisma, a skan przeniesiono do archiwum.');
      setWybrany(null); setRozpoznanie(null); await odswiez();
    } catch (e) { setBlad(e); } finally { setZajety(false); }
  }

  async function usun() {
    if (!usuniecie) return;
    setZajety(true); setBlad(null);
    try {
      await api.wyslij(`/skany/${usuniecie.id}/kosz`, { powod: powodUsuniecia });
      if (wybrany?.id === usuniecie.id) { setWybrany(null); setRozpoznanie(null); }
      setUsuniecie(null); setWynikTerminu(''); setKomunikat('Skan przeniesiono do kosza. Możesz zeskanować dokument ponownie.');
      await odswiez();
    } catch (e) { setBlad(e); } finally { setZajety(false); }
  }

  return <section>
    <div className="naglowek-sekcji"><h1>Skany ze skanerów</h1>
      <button disabled={zajety} onClick={() => odswiez().catch(setBlad)}>Odśwież listę</button></div>
    <p>Wybierz odebrany skan. Odczyt tekstu zaproponuje sprawę na podstawie jej znaku lub znaku wcześniejszego pisma.</p>
    <Komunikat blad={blad} />
    {komunikat && <p role="status">{komunikat} {sprawaId && <button onClick={() => otworzSprawe(Number(sprawaId))}>Otwórz sprawę</button>}</p>}
    {wynikTerminu && <p role="status">{wynikTerminu}</p>}
    {usuniecie && <div className="karta formularz" role="alertdialog" aria-label="Usunięcie skanu">
      <h2>Usunąć skan „{usuniecie.nazwa}”?</h2><p>Plik zostanie przeniesiony do kosza poza listą skanów. Dokumenty w sprawach pozostaną zachowane.</p>
      <Pole etykieta="Powód usunięcia (opcjonalnie)"><input maxLength={500} value={powodUsuniecia} onChange={e => setPowodUsuniecia(e.target.value)} /></Pole>
      <button disabled={zajety} onClick={usun}>Potwierdź usunięcie skanu</button>
      <button disabled={zajety} onClick={() => setUsuniecie(null)}>Anuluj usunięcie</button>
    </div>}
    {skany.length === 0 && <p>Brak skanów oczekujących na przypisanie.</p>}
    {skany.length > 0 && <div className="karta"><table><thead><tr><th>Plik</th><th>Skaner</th><th>Data wpływu</th><th>Termin odpowiedzi / wykonania</th><th>Rozmiar</th><th>Wybór</th></tr></thead>
      <tbody>{skany.map(s => <tr key={s.id}><td>{s.nazwa}</td><td>{s.zrodlo}</td><td>{s.dataWplywu ? s.dataWplywu.split('-').reverse().join('.') : 'Nie zapisano'}</td><td>{s.terminOdpowiedzi ? s.terminOdpowiedzi.dataUplywu.split('-').reverse().join('.') : 'Nie ustawiono'}</td><td>{Math.ceil(s.rozmiarBajtow / 1024)} KB</td>
        <td><button disabled={zajety || !s.gotowy || s.zaDuzy} onClick={() => wybierz(s)}>
          {s.zaDuzy ? 'Przekracza 10 MiB' : !s.gotowy ? 'Trwa odbiór…' : wybrany?.id === s.id ? 'Wybrany' : 'Wybierz'}</button> <button disabled={zajety || !s.gotowy} onClick={() => { setUsuniecie(s); setPowodUsuniecia(''); setBlad(null); }}>Usuń skan</button></td></tr>)}</tbody></table></div>}
    {wybrany && <div className="karta formularz"><h2>{wybrany.nazwa}</h2>
      <button disabled={zajety} onClick={rozpoznaj}>{zajety ? 'Przetwarzanie…' : 'Rozpoznaj tekst, sprawę i termin'}</button>
      <div className="data-wplywu">
        <Pole etykieta="Data wpływu / doręczenia"><input type="date" value={data} readOnly={Boolean(pismo?.dataDoreczenia)} disabled={zajety}
          onChange={e => setDataWplywu(e.target.value)} /></Pole>
        {!pismo?.dataDoreczenia && <>
          <button disabled={zajety} onClick={() => setDataWplywu(dzisiaj())}>Dzisiaj</button>
          <button disabled={zajety || !data || data === wybrany.dataWplywu} onClick={zapiszDate}>Zapisz</button>
          {wybrany.dataWplywu && data === wybrany.dataWplywu ?
            <p role="status">Zapisano datę wpływu: <strong>{data.split('-').reverse().join('.')}</strong>. Data pozostanie przy skanie po odświeżeniu strony.</p> :
            data && <p role="status">Data została zmieniona. Kliknij Zapisz, aby ją zachować przy skanie.</p>}
        </>}
        <p>{pismo?.dataDoreczenia ? 'Pismo ma już zapisaną datę doręczenia. Dodanie skanu jej nie zmieni.' :
          'Wpisz rzeczywisty dzień otrzymania pisma. Dzień skanowania nie jest datą wpływu. Data jest wymagana przy dodawaniu treści pisma przychodzącego.'}</p>
      </div>
      <TerminOdpowiedziSkanu key={`${wybrany.id}/${wybrany.terminOdpowiedzi?.dataUplywu ?? ''}/${wybrany.dataWplywu ?? ''}`}
        id={wybrany.id} dataWplywu={data} dataZapisana={Boolean(data && data === wybrany.dataWplywu)} zapisany={wybrany.terminOdpowiedzi ?? null}
        propozycje={rozpoznanie?.propozycjeTerminow ?? []} ocrWykonany={Boolean(rozpoznanie)} odczytaj={rozpoznaj} zajety={zajety} ustawZajety={setZajety}
        poZapisaniu={termin => {
          const id = wybrany.id;
          setWybrany(s => s?.id === id ? { ...s, terminOdpowiedzi: termin } : s);
          setSkany(lista => lista.map(s => s.id === id ? { ...s, terminOdpowiedzi: termin } : s));
        }} />
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
        <Pole etykieta="Pismo, do którego dodasz skan"><select disabled={zajety} value={pismoId} onChange={e => { setPismoId(e.target.value); setRegulaDoreczenia(''); setWynikTerminu(''); }}>
          <option value="">Wybierz pismo</option>{szczegoly.pisma.map(p => <option key={p.id} value={p.id}>#{p.id} {p.rodzaj} — {p.korespondent}</option>)}</select></Pole>
        {pismo?.kierunek === 'przychodzace' && !pismo.dataDoreczenia && !wybrany.terminOdpowiedzi && <>
          <Pole etykieta="Reguła terminu od wpływu / doręczenia"><select disabled={zajety} value={regulaDoreczenia} onChange={e => setRegulaDoreczenia(e.target.value)}>
            <option value="">Bez wyznaczania terminu</option>{reguly.filter(r => r.zdarzeniePoczatkowe === 'doreczenie').map(r => <option key={r.id} value={r.id}>{r.nazwa} — {r.liczbaDni} {r.sposobLiczenia === 'dni_robocze' ? 'dni roboczych' : 'dni'}</option>)}</select></Pole>
          <p>{regulaDoreczenia ? 'Termin zostanie wyznaczony według wybranej reguły i wpisanej daty doręczenia.' : 'Nie wybrano reguły — samo dodanie daty nie utworzy terminu. Sprawdź termin wskazany w piśmie.'}</p>
        </>}
        <button disabled={zajety} onClick={() => setNowePismo(!nowePismo)}>{nowePismo ? 'Zamknij formularz pisma' : 'Zarejestruj nowe pismo'}</button>
        <Pole etykieta="Rola dokumentu"><select disabled={zajety} value={rola} onChange={e => setRola(e.target.value as RolaDokumentu)}>
          {Object.entries(nazwyRolDokumentow).map(([id, nazwa]) => <option key={id} value={id}>{nazwa}</option>)}</select></Pole>
        <button disabled={zajety || !pismoId || nowePismo || (wymaganaData && !data)} onClick={importuj}>Potwierdź i dodaj dokument do pisma</button>
      </>}
    </div>}
    {wybrany && szczegoly && nowePismo && <FormularzPisma key={`${wybrany.id}/${sprawaId}`} sprawaId={Number(sprawaId)} pisma={szczegoly.pisma} reguly={wybrany.terminOdpowiedzi ? [] : reguly} wplywSkanu={{ data: dataWplywu, wymagana: rola === 'tresc' }}
      poZapisaniu={wynik => { setWynikTerminu(wybrany.terminOdpowiedzi ? 'Pismo zapisano. Termin ze skanu zostanie dodany podczas importu dokumentu.' : wynik.termin ? `Termin: ${wynik.termin.czynnosc} — ${wynik.termin.dataUplywu.split('-').reverse().join('.')}.` : 'Pismo zapisano bez terminu. Sprawdź regułę i termin wskazany w piśmie.'); setSzczegoly({ ...szczegoly, pisma: [...szczegoly.pisma, wynik.pismo] }); setPismoId(String(wynik.pismo.id)); setNowePismo(false); }} />}
  </section>;
}
