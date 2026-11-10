import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { Komunikat, Pole } from './wspolne';
import { podgrupy, sciezkaGrupy } from './grupy';
import type { GrupaSpraw, ProfilFirmy } from '../typy';

export function FirmaIDrzewo({ poZmianieFirmy }: { poZmianieFirmy: (firma: ProfilFirmy) => void }) {
  const [firma, setFirma] = useState<ProfilFirmy | null>(null);
  const [grupy, setGrupy] = useState<GrupaSpraw[]>([]);
  const [id, setId] = useState<number | null>(null);
  const [nazwa, setNazwa] = useState(''); const [rodzic, setRodzic] = useState(''); const [kolejnosc, setKolejnosc] = useState(0);
  const [blad, setBlad] = useState<unknown>(null); const [zajety, setZajety] = useState(false);
  const [komunikat, setKomunikat] = useState(''); const [usuniecie, setUsuniecie] = useState(false);
  async function wczytajGrupy() { setGrupy((await api.pobierz<{ grupy: GrupaSpraw[] }>('/grupy')).grupy); }
  useEffect(() => { Promise.all([api.pobierz<{ firma: ProfilFirmy }>('/firma').then(w => setFirma(w.firma)), wczytajGrupy()]).catch(setBlad); }, []);
  function edytuj(g?: GrupaSpraw) { setId(g?.id ?? null); setNazwa(g?.nazwa ?? ''); setRodzic(g?.rodzicId ? String(g.rodzicId) : ''); setKolejnosc(g?.kolejnosc ?? 0); setUsuniecie(false); }
  async function wykonaj(akcja: () => Promise<void>) { setBlad(null); setKomunikat(''); setZajety(true); try { await akcja(); } catch (e) { setBlad(e); } finally { setZajety(false); } }
  async function zapiszGrupe(e: FormEvent) {
    e.preventDefault(); await wykonaj(async () => {
      const dane = { nazwa, rodzicId: rodzic ? Number(rodzic) : null, kolejnosc };
      if (id === null) await api.wyslij('/grupy', dane); else await api.zmien(`/grupy/${id}`, dane);
      await wczytajGrupy(); edytuj(); setKomunikat('Zapisano grupę. Powiązania spraw zostały zachowane.');
    });
  }
  const wykluczone = id === null ? new Set<number>() : podgrupy(grupy, id);
  return <section><h1>Firma i drzewo spraw</h1><Komunikat blad={blad} />{komunikat && <p role="status">{komunikat}</p>}
    {firma && <form className="karta formularz" onSubmit={e => { e.preventDefault(); void wykonaj(async () => {
      const wynik = await api.zmien<{ firma: ProfilFirmy }>('/firma', firma); setFirma(wynik.firma); poZmianieFirmy(wynik.firma); setKomunikat('Zapisano profil firmy.');
    }); }}><h2>Profil firmy</h2><p>Ta instalacja obsługuje jedną organizację.</p><fieldset disabled={zajety} className="siatka">
      {([['nazwa','Nazwa firmy'],['nip','NIP / identyfikator podatkowy'],['email','E-mail firmy'],['telefon','Telefon'],['adres','Adres'],['stronaWww','Strona WWW']] as const).map(([pole, etykieta]) =>
        <Pole key={pole} etykieta={etykieta}><input required={pole === 'nazwa'} type={pole === 'email' ? 'email' : pole === 'stronaWww' ? 'url' : 'text'} value={firma[pole]} onChange={e => setFirma({ ...firma, [pole]: e.target.value })} /></Pole>)}
      </fieldset><button disabled={zajety}>Zapisz firmę</button></form>}
    <h2>Grupy i podgrupy</h2><p>Zmiana nazwy lub położenia grupy zachowuje dokumenty i terminy spraw. Usunąć można pustą grupę.</p>
    {!grupy.length && <button disabled={zajety} onClick={() => wykonaj(async () => { await api.wyslij('/grupy/szablon-creationx', {}); await wczytajGrupy(); setKomunikat('Utworzono drzewo dla CreationX.'); })}>Utwórz drzewo CreationX</button>}
    <div className="uklad-drzewa"><div className="karta"><button disabled={zajety} onClick={() => edytuj()}>Nowa grupa</button>
      <ul>{grupy.map(g => <li key={g.id}><button disabled={zajety} onClick={() => edytuj(g)}>{sciezkaGrupy(grupy, g.id)}</button></li>)}</ul></div>
      <form className="karta formularz" onSubmit={zapiszGrupe}><h3>{id === null ? 'Nowa grupa' : 'Edycja grupy'}</h3>
        <fieldset disabled={zajety}><Pole etykieta="Nazwa grupy"><input required maxLength={150} value={nazwa} onChange={e => setNazwa(e.target.value)} /></Pole>
          <Pole etykieta="Grupa nadrzędna"><select value={rodzic} onChange={e => setRodzic(e.target.value)}><option value="">Poziom główny</option>
            {grupy.filter(g => !wykluczone.has(g.id)).map(g => <option key={g.id} value={g.id}>{sciezkaGrupy(grupy, g.id)}</option>)}</select></Pole>
          <Pole etykieta="Kolejność"><input type="number" min={0} max={10000} value={kolejnosc} onChange={e => setKolejnosc(Number(e.target.value))} /></Pole>
        </fieldset><button disabled={zajety}>Zapisz grupę</button>
        {id !== null && <><button type="button" disabled={zajety} onClick={() => setUsuniecie(true)}>Usuń pustą grupę</button>
          {usuniecie && <div role="alert"><p>Usunąć grupę „{nazwa}”?</p><button type="button" disabled={zajety} onClick={() => wykonaj(async () => { await api.usun(`/grupy/${id}`); await wczytajGrupy(); edytuj(); setKomunikat('Usunięto pustą grupę.'); })}>Potwierdź usunięcie grupy</button><button type="button" onClick={() => setUsuniecie(false)}>Anuluj</button></div>}</>}
      </form></div>
  </section>;
}
