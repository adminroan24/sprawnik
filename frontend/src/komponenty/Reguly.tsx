import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { Komunikat, Pole } from './wspolne';
import type { Regula } from '../typy';

/** Definiowanie reguł dostępne w interfejsie i API wyłącznie administratorowi. */
export function Reguly() {
  const [reguly, setReguly] = useState<Regula[]>([]);
  const [nazwa, setNazwa] = useState('');
  const [liczbaDni, setLiczbaDni] = useState('14');
  const [sposob, setSposob] = useState<Regula['sposobLiczenia']>('dni_kalendarzowe');
  const [zdarzenie, setZdarzenie] = useState<Regula['zdarzeniePoczatkowe']>('doreczenie');
  const [przesuwaj, setPrzesuwaj] = useState(true);
  const [opis, setOpis] = useState('');
  const [blad, setBlad] = useState<unknown>(null);
  const [zapis, setZapis] = useState(false);
  const [komunikat, setKomunikat] = useState('');

  async function wczytaj() {
    const dane = await api.pobierz<{ reguly: Regula[] }>('/reguly');
    setReguly(dane.reguly);
  }
  useEffect(() => { wczytaj().catch(setBlad); }, []);

  async function dodaj(e: FormEvent) {
    e.preventDefault();
    setZapis(true);
    setBlad(null);
    setKomunikat('');
    try {
      await api.wyslij('/reguly', { nazwa, liczbaDni: Number(liczbaDni), sposobLiczenia: sposob,
        zdarzeniePoczatkowe: zdarzenie, przesuwajDniWolne: przesuwaj, opis: opis.trim() || null });
      setKomunikat(`Dodano regułę „${nazwa}”.`);
      setNazwa('');
      setOpis('');
      await wczytaj();
    } catch (problem) { setBlad(problem); }
    finally { setZapis(false); }
  }

  return <section>
    <h2>Reguły terminów</h2>
    <Komunikat blad={blad} />
    {komunikat && <div className="komunikat informacja" role="status">{komunikat}</div>}
    <form className="karta formularz" onSubmit={dodaj}>
      <h3>Nowa reguła</h3>
      <div className="siatka">
        <Pole etykieta="Nazwa reguły"><input required value={nazwa} onChange={(e) => setNazwa(e.target.value)} /></Pole>
        <Pole etykieta="Liczba dni"><input type="number" min="1" step="1" required value={liczbaDni}
          onChange={(e) => setLiczbaDni(e.target.value)} /></Pole>
        <Pole etykieta="Sposób liczenia"><select value={sposob}
          onChange={(e) => setSposob(e.target.value as Regula['sposobLiczenia'])}>
          <option value="dni_kalendarzowe">Dni kalendarzowe</option><option value="dni_robocze">Dni robocze</option>
        </select></Pole>
        <Pole etykieta="Zdarzenie początkowe"><select value={zdarzenie}
          onChange={(e) => setZdarzenie(e.target.value as Regula['zdarzeniePoczatkowe'])}>
          <option value="doreczenie">Doręczenie</option><option value="nadanie">Nadanie</option>
        </select></Pole>
      </div>
      <Pole etykieta="Opis"><textarea value={opis} onChange={(e) => setOpis(e.target.value)} rows={2} /></Pole>
      <label><input type="checkbox" checked={przesuwaj} onChange={(e) => setPrzesuwaj(e.target.checked)} />
        Przesuwaj koniec terminu przypadający w dniu wolnym</label>
      <div><button type="submit" disabled={zapis}>{zapis ? 'Zapisywanie…' : 'Dodaj regułę'}</button></div>
    </form>
    <table><thead><tr><th>Reguła</th><th>Dni</th><th>Sposób liczenia</th><th>Bieg od</th></tr></thead>
      <tbody>{reguly.map((regula) => <tr key={regula.id}>
        <td>{regula.nazwa}</td><td>{regula.liczbaDni}</td>
        <td>{regula.sposobLiczenia === 'dni_robocze' ? 'dni robocze' : 'dni kalendarzowe'}</td>
        <td>{regula.zdarzeniePoczatkowe === 'doreczenie' ? 'doręczenia' : 'nadania'}</td>
      </tr>)}</tbody>
    </table>
  </section>;
}
