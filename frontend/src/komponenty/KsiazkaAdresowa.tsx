import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { DaneKontaktu, Kontakt } from '../typy';
import { Komunikat, Pole } from './wspolne';

export const typyKontaktow = { osoba: 'Osoba', firma: 'Firma', instytucja: 'Instytucja / urząd' };
const pusty: Omit<Kontakt, 'id'> = { typ: 'instytucja', nazwa: '', nip: '', email: '', telefon: '', adres: '',
  adresEdoreczen: '', skrzynkaEpuap: '', osobaKontaktowa: '', notatka: '', aktywny: true };

export function DaneKontaktowe({ dane }: { dane: DaneKontaktu }) {
  return <div className="drobne">
    {dane.adres && <p style={{ whiteSpace: 'pre-wrap' }}>{dane.adres}</p>}
    {dane.email && <p>E-mail: {dane.email}</p>}{dane.telefon && <p>Telefon: {dane.telefon}</p>}
    {dane.nip && <p>NIP: {dane.nip}</p>}{dane.osobaKontaktowa && <p>Osoba do kontaktu: {dane.osobaKontaktowa}</p>}
    {dane.adresEdoreczen && <p>e-Doręczenia: {dane.adresEdoreczen}</p>}{dane.skrzynkaEpuap && <p>ePUAP: {dane.skrzynkaEpuap}</p>}
  </div>;
}

export function KsiazkaAdresowa({ administrator }: { administrator: boolean }) {
  const [kontakty, setKontakty] = useState<Kontakt[]>([]);
  const [szukaj, setSzukaj] = useState('');
  const [archiwalne, setArchiwalne] = useState(false);
  const [edycja, setEdycja] = useState<Kontakt | 'nowy' | null>(null);
  const [usuniecie, setUsuniecie] = useState<Kontakt | null>(null);
  const [blad, setBlad] = useState<unknown>(null);
  const [komunikat, setKomunikat] = useState('');
  const [wersja, setWersja] = useState(0);
  const [zajety, setZajety] = useState(false);
  const [wczytywanie, setWczytywanie] = useState(true);
  useEffect(() => {
    let aktualne = true; setWczytywanie(true);
    const timer = setTimeout(() => {
      api.pobierz<{ kontakty: Kontakt[] }>(`/kontakty?szukaj=${encodeURIComponent(szukaj)}&archiwalne=${archiwalne}`)
        .then(w => { if (aktualne) setKontakty(w.kontakty); })
        .catch(e => { if (aktualne) setBlad(e); })
        .finally(() => { if (aktualne) setWczytywanie(false); });
    }, 250);
    return () => { aktualne = false; clearTimeout(timer); };
  }, [szukaj, archiwalne, wersja]);
  return <section>
    <header className="naglowek-sekcji"><h1>Książka adresowa</h1>
      {administrator && <button onClick={() => { setEdycja('nowy'); setBlad(null); setKomunikat(''); }}>Dodaj kontakt</button>}
    </header>
    <p>Kontakty firmy, instytucji i osób do wyboru jako nadawcy lub adresaci pism.</p>
    <Komunikat blad={blad} />{komunikat && <p role="status">{komunikat}</p>}
    {edycja && administrator && <FormularzKontaktu key={edycja === 'nowy' ? 'nowy' : edycja.id}
      kontakt={edycja === 'nowy' ? null : edycja} anuluj={() => setEdycja(null)} poZapisaniu={() => {
        setEdycja(null); setWersja(v => v + 1); setKomunikat('Kontakt zapisano.');
      }} />}
    <div className="filtry"><Pole etykieta="Szukaj kontaktu"><input value={szukaj} maxLength={200} placeholder="Nazwa, NIP, e-mail, adres lub telefon" onChange={e => setSzukaj(e.target.value)} /></Pole>
      <label><input type="checkbox" checked={archiwalne} onChange={e => setArchiwalne(e.target.checked)} /> Pokaż także wyłączone kontakty</label>
    </div>
    {usuniecie && <div className="karta" role="alertdialog" aria-label="Usunięcie kontaktu">
      <p>Usunąć kontakt „{usuniecie.nazwa}”? Kontakt użyty w piśmie można wyłączyć w edycji.</p>
      <button disabled={zajety} onClick={async () => {
        setZajety(true); setBlad(null);
        try { await api.usun(`/kontakty/${usuniecie.id}`); setUsuniecie(null); setWersja(v => v + 1); setKomunikat('Kontakt usunięto.'); }
        catch (e) { setBlad(e); } finally { setZajety(false); }
      }}>Potwierdź usunięcie kontaktu</button>
      <button disabled={zajety} onClick={() => setUsuniecie(null)}>Anuluj usunięcie</button>
    </div>}
    {wczytywanie ? <p>Wczytywanie kontaktów…</p> : kontakty.length === 0 ? <p>Brak kontaktów spełniających warunki wyszukiwania.{administrator && ' Dodaj kontakt przyciskiem powyżej.'}</p> :
      <div className="karta"><table><thead><tr><th>Nazwa</th><th>Typ</th><th>Dane kontaktowe</th><th>Uwagi</th>{administrator && <th>Akcje</th>}</tr></thead>
        <tbody>{kontakty.map(k => <tr key={k.id}><td>{k.nazwa}{!k.aktywny && <div className="drobne">Kontakt wyłączony</div>}</td>
          <td>{typyKontaktow[k.typ]}</td><td><DaneKontaktowe dane={k} /></td><td style={{ whiteSpace: 'pre-wrap' }}>{k.notatka}</td>
          {administrator && <td><button onClick={() => { setEdycja(k); setBlad(null); }}>Edytuj</button> <button className="drugorzedny" onClick={() => { setUsuniecie(k); setBlad(null); }}>Usuń kontakt</button></td>}
        </tr>)}</tbody></table></div>}
    {!administrator && <p>Dane kontaktów uzupełnia administrator.</p>}
  </section>;
}

function FormularzKontaktu({ kontakt, anuluj, poZapisaniu }: { kontakt: Kontakt | null; anuluj: () => void; poZapisaniu: () => void }) {
  const [dane, setDane] = useState<Omit<Kontakt, 'id'>>(kontakt ?? pusty);
  const [blad, setBlad] = useState<unknown>(null);
  const [zapis, setZapis] = useState(false);
  const tekst = (klucz: keyof DaneKontaktu | 'notatka', wartosc: string) => setDane(d => ({ ...d, [klucz]: wartosc }));
  async function wyslij(e: FormEvent) {
    e.preventDefault(); setZapis(true); setBlad(null);
    try {
      if (kontakt) await api.zmien(`/kontakty/${kontakt.id}`, dane); else await api.wyslij('/kontakty', dane);
      poZapisaniu();
    } catch (e) { setBlad(e); } finally { setZapis(false); }
  }
  return <form className="karta formularz" onSubmit={wyslij}><h2>{kontakt ? 'Edycja kontaktu' : 'Nowy kontakt'}</h2>
    <Komunikat blad={blad} /><fieldset disabled={zapis}><div className="siatka">
      <Pole etykieta="Typ kontaktu"><select value={dane.typ} onChange={e => tekst('typ', e.target.value)}>{Object.entries(typyKontaktow).map(([v,n]) => <option key={v} value={v}>{n}</option>)}</select></Pole>
      <Pole etykieta="Nazwa / imię i nazwisko"><input required maxLength={200} value={dane.nazwa} onChange={e => tekst('nazwa', e.target.value)} /></Pole>
      <Pole etykieta="NIP"><input maxLength={30} value={dane.nip} onChange={e => tekst('nip', e.target.value)} /></Pole>
      <Pole etykieta="Osoba do kontaktu"><input maxLength={200} value={dane.osobaKontaktowa} onChange={e => tekst('osobaKontaktowa', e.target.value)} /></Pole>
      <Pole etykieta="E-mail"><input type="email" maxLength={254} value={dane.email} onChange={e => tekst('email', e.target.value)} /></Pole>
      <Pole etykieta="Telefon"><input type="tel" maxLength={60} value={dane.telefon} onChange={e => tekst('telefon', e.target.value)} /></Pole>
      <Pole etykieta="Adres do korespondencji"><textarea maxLength={1000} rows={3} value={dane.adres} onChange={e => tekst('adres', e.target.value)} /></Pole>
      <Pole etykieta="Adres e-Doręczeń"><input maxLength={200} value={dane.adresEdoreczen} onChange={e => tekst('adresEdoreczen', e.target.value)} /></Pole>
      <Pole etykieta="Skrytka ePUAP"><input maxLength={200} value={dane.skrzynkaEpuap} onChange={e => tekst('skrzynkaEpuap', e.target.value)} /></Pole>
    </div>
    <Pole etykieta="Uwagi wewnętrzne"><textarea rows={2} maxLength={2000} value={dane.notatka} onChange={e => tekst('notatka', e.target.value)} /></Pole>
    <label><input type="checkbox" checked={dane.aktywny} onChange={e => setDane(d => ({ ...d, aktywny: e.target.checked }))} /> Kontakt aktywny</label>
    <p>Wyłączony kontakt pozostaje w historii pism, ale znika z listy wyboru nowych adresatów.</p>
    <button type="submit">{zapis ? 'Zapisywanie…' : 'Zapisz kontakt'}</button> <button type="button" className="drugorzedny" onClick={anuluj}>Anuluj</button>
    </fieldset>
  </form>;
}
