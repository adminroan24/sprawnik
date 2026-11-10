import { useState } from 'react';
import { api } from '../api/client';
import { Komunikat, Pole } from './wspolne';
import type { PropozycjaTerminuSkanu, TerminSkanu, UstawieniaTerminuSkanu } from '../typy';

const dataPl = (data: string) => data.split('-').reverse().join('.');
export function TerminOdpowiedziSkanu({ id, dataWplywu, dataZapisana, zapisany, propozycje, ocrWykonany, odczytaj,
  zajety, ustawZajety, poZapisaniu }: { id: string; dataWplywu: string; dataZapisana: boolean; zapisany: TerminSkanu | null;
  propozycje: PropozycjaTerminuSkanu[]; ocrWykonany: boolean; odczytaj: () => void;
  zajety: boolean; ustawZajety: (stan: boolean) => void; poZapisaniu: (termin: TerminSkanu) => void }) {
  const u = zapisany?.ustawienia;
  const [tryb, setTryb] = useState<'dni' | 'data'>(u?.tryb ?? 'dni');
  const [dni, setDni] = useState(u?.tryb === 'dni' ? String(u.liczbaDni) : '');
  const [sposob, setSposob] = useState<'dni_kalendarzowe' | 'dni_robocze'>(u?.tryb === 'dni' ? u.sposobLiczenia : 'dni_kalendarzowe');
  const [przesuwaj, setPrzesuwaj] = useState(u?.tryb === 'dni' ? u.przesuwajDniWolne : false);
  const [innaData, setInnaData] = useState(Boolean(u?.tryb === 'dni' && u.dataPoczatkowa));
  const [poczatek, setPoczatek] = useState(u?.tryb === 'dni' ? u.dataPoczatkowa ?? '' : '');
  const [koniec, setKoniec] = useState(u?.tryb === 'data' ? u.dataUplywu : '');
  const [zrodlo, setZrodlo] = useState<'reczny' | 'ocr'>(u?.zrodlo ?? 'reczny');
  const [fragment, setFragment] = useState(u?.fragment ?? '');
  const [podglad, setPodglad] = useState<TerminSkanu | null>(null);
  const [potwierdzono, setPotwierdzono] = useState(false);
  const [blad, setBlad] = useState<unknown>(null);
  function zmiana() { setPodglad(null); setPotwierdzono(false); setZrodlo('reczny'); setBlad(null); }
  function propozycja(p: PropozycjaTerminuSkanu) {
    zmiana(); setTryb(p.ustawienia.tryb); setZrodlo('ocr'); setFragment(p.fragment);
    if (p.ustawienia.tryb === 'data') setKoniec(p.ustawienia.dataUplywu);
    else { setDni(String(p.ustawienia.liczbaDni)); setSposob(p.ustawienia.sposobLiczenia);
      setPrzesuwaj(false); setInnaData(p.podstawa === 'inna'); setPoczatek(''); }
  }
  function ustawienia(): UstawieniaTerminuSkanu {
    return tryb === 'data' ? { tryb, dataUplywu: koniec, zrodlo, fragment } : {
      tryb, liczbaDni: Number(dni), sposobLiczenia: sposob, przesuwajDniWolne: przesuwaj,
      dataPoczatkowa: innaData ? poczatek : null, zrodlo, fragment,
    };
  }
  async function wykonaj(zapis: boolean) {
    ustawZajety(true); setBlad(null);
    try {
      if (zapis) {
        const wynik = await api.zmien<{ terminOdpowiedzi: TerminSkanu }>(`/skany/${id}/termin-odpowiedzi`, { termin: ustawienia(), potwierdzono });
        poZapisaniu(wynik.terminOdpowiedzi); setPodglad(null); setPotwierdzono(false);
      } else {
        const wynik = await api.wyslij<{ terminOdpowiedzi: TerminSkanu }>(`/skany/${id}/termin-odpowiedzi/podglad`, ustawienia());
        setPodglad(wynik.terminOdpowiedzi); setPotwierdzono(false);
      }
    } catch (e) { setBlad(e); } finally { ustawZajety(false); }
  }
  return <div className="karta formularz">
    <h3>Termin odpowiedzi / wykonania</h3>
    <Komunikat blad={blad} />
    {zapisany && <div role="status"><strong>Zapisany termin: {dataPl(zapisany.dataUplywu)}</strong>
      {zapisany.ostrzezenie && <p role="alert">{zapisany.ostrzezenie}</p>}
      <p>Po imporcie treści pisma termin pojawi się w sprawie i przeglądzie terminów.</p></div>}
    <button disabled={zajety} onClick={odczytaj}>Odczytaj wezwanie i termin</button>
    {propozycje.length > 1 && <p>Znaleziono kilka terminów. Porównaj fragmenty i wybierz właściwy.</p>}
    {propozycje.map((p, i) => <div key={i}><blockquote>{p.fragment}</blockquote>
      <button disabled={zajety || !dataZapisana} onClick={() => propozycja(p)}>Użyj propozycji: {p.ustawienia.tryb === 'data' ? `do ${dataPl(p.ustawienia.dataUplywu)}` : `${p.ustawienia.liczbaDni} ${p.ustawienia.sposobLiczenia === 'dni_robocze' ? 'dni roboczych' : 'dni'}`}</button>
      {p.podstawa === 'inna' && <p>Nie odczytano jednoznacznej podstawy liczenia. Uzupełnij właściwą datę początkową.</p>}</div>)}
    {ocrWykonany && !propozycje.length && <p>Nie znaleziono jednoznacznego terminu w odczytanym tekście. Ustaw go ręcznie poniżej.</p>}
    {!dataZapisana && <p>Najpierw zapisz datę wpływu powyżej. Możesz wyznaczyć termin bez wybierania sprawy.</p>}
    <fieldset disabled={zajety || !dataZapisana}>
      <legend>Ustaw termin ręcznie lub popraw propozycję OCR</legend>
      <Pole etykieta="Sposób określenia terminu"><select value={tryb} onChange={e => { zmiana(); setTryb(e.target.value as 'dni' | 'data'); }}>
        <option value="dni">Liczba dni</option><option value="data">Konkretna data</option></select></Pole>
      {tryb === 'data' ? <Pole etykieta="Termin odpowiedzi — data"><input type="date" value={koniec} onChange={e => { zmiana(); setKoniec(e.target.value); }} /></Pole> : <>
        <Pole etykieta="Liczba dni na odpowiedź"><input type="number" min={1} max={365} value={dni} onChange={e => { zmiana(); setDni(e.target.value); }} /></Pole>
        <Pole etykieta="Rodzaj dni"><select value={sposob} onChange={e => { zmiana(); setSposob(e.target.value as typeof sposob); }}>
          <option value="dni_kalendarzowe">Dni kalendarzowe</option><option value="dni_robocze">Dni robocze</option></select></Pole>
        <Pole etykieta="Początek liczenia"><select value={innaData ? 'inna' : 'wplyw'} onChange={e => { zmiana(); setInnaData(e.target.value === 'inna'); }}>
          <option value="wplyw">Data wpływu: {dataPl(dataWplywu)}</option><option value="inna">Inna data początkowa</option></select></Pole>
        {innaData && <Pole etykieta="Inna data początkowa"><input type="date" value={poczatek} onChange={e => { zmiana(); setPoczatek(e.target.value); }} /></Pole>}
        <label><input type="checkbox" checked={przesuwaj} onChange={e => { zmiana(); setPrzesuwaj(e.target.checked); }} /> Przesuń koniec z soboty, niedzieli lub święta na następny dzień roboczy</label>
        <p>Dni liczone są po wskazanej dacie początkowej. Wybierz sposób zgodny z pismem.</p>
      </>}
      <button onClick={() => wykonaj(false)}>Pokaż termin odpowiedzi</button>
      {podglad && <div><p><strong>Termin odpowiedzi / wykonania: {dataPl(podglad.dataUplywu)}</strong></p>
        {podglad.dataUplywuPrzedPrzesunieciem !== podglad.dataUplywu && <p>Przed przesunięciem dnia wolnego: {dataPl(podglad.dataUplywuPrzedPrzesunieciem)}.</p>}
        {podglad.ostrzezenie && <p role="alert">{podglad.ostrzezenie}</p>}
        <label><input type="checkbox" checked={potwierdzono} onChange={e => setPotwierdzono(e.target.checked)} /> Sprawdziłem termin i podstawę liczenia z pismem</label>
      </div>}
      <button disabled={!podglad || !potwierdzono} onClick={() => wykonaj(true)}>Zapisz termin odpowiedzi</button>
    </fieldset>
  </div>;
}
