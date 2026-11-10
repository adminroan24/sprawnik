import { useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { Komunikat, Pole } from './wspolne';
import { nazwyKanalow, type KanalPisma, type Pismo, type KierunekPisma, type Regula, type WynikRejestracjiPisma } from '../typy';

/**
 * UC3 i UC4 — rejestracja pisma.
 *
 * Data nadania i data doręczenia to dwa odrębne pola, a doręczenie może
 * pozostać nieznane: to główne założenie systemu widoczne wprost w formularzu.
 */
export function FormularzPisma({
  sprawaId,
  reguly,
  poZapisaniu,
  pisma = [],
  odpowiedzNa = null,
}: {
  sprawaId: number;
  reguly: Regula[];
  poZapisaniu: (wynik: WynikRejestracjiPisma) => void;
  pisma?: Pismo[];
  odpowiedzNa?: Pismo | null;
}) {
  const [kierunek, setKierunek] = useState<KierunekPisma>(odpowiedzNa ?
    (odpowiedzNa.kierunek === 'przychodzace' ? 'wychodzace' : 'przychodzace') : 'przychodzace');
  const [rodzaj, setRodzaj] = useState(odpowiedzNa ? 'Odpowiedź' : '');
  const [korespondent, setKorespondent] = useState(odpowiedzNa?.korespondent ?? '');
  const [znakPisma, setZnakPisma] = useState('');
  const [dataNadania, setDataNadania] = useState('');
  const [dataDoreczenia, setDataDoreczenia] = useState('');
  const [regulaId, setRegulaId] = useState('');
  const [czynnosc, setCzynnosc] = useState('');
  const [blad, setBlad] = useState<unknown>(null);
  const [kanal, setKanal] = useState<KanalPisma | ''>('');
  const [numerNadania, setNumerNadania] = useState('');
  const [poprzednieId, setPoprzednieId] = useState(odpowiedzNa ? String(odpowiedzNa.id) : '');

  const wybranaRegula = reguly.find((regula) => String(regula.id) === regulaId) ?? null;

  async function wyslij(zdarzenie: FormEvent) {
    zdarzenie.preventDefault();
    try {
      const wynik = await api.wyslij<WynikRejestracjiPisma>(`/sprawy/${sprawaId}/pisma`, {
        kierunek,
        rodzaj,
        korespondent,
        znakPisma,
        dataNadania: dataNadania || null,
        dataDoreczenia: dataDoreczenia || null,
        regulaId: regulaId ? Number(regulaId) : null,
        czynnosc,
        kanal: kanal || null, numerNadania, odpowiedzNaPismoId: poprzednieId ? Number(poprzednieId) : null,
      });
      poZapisaniu(wynik);
    } catch (problem) {
      setBlad(problem);
    }
  }

  return (
    <form onSubmit={wyslij} className="karta formularz">
      <h3>Rejestracja pisma</h3>
      <Komunikat blad={blad} />

      <div className="siatka">
        <Pole etykieta="Kierunek">
          <select value={kierunek} onChange={(e) => setKierunek(e.target.value as KierunekPisma)}>
            <option value="przychodzace">Przychodzące</option>
            <option value="wychodzace">Wychodzące</option>
          </select>
        </Pole>
        <Pole etykieta="Rodzaj pisma">
          <input
            value={rodzaj}
            onChange={(e) => setRodzaj(e.target.value)}
            placeholder="np. decyzja, wezwanie"
            required
          />
        </Pole>
        <Pole etykieta={kierunek === 'przychodzace' ? 'Nadawca' : 'Adresat'}>
          <input value={korespondent} onChange={(e) => setKorespondent(e.target.value)} required />
        </Pole>
        <Pole etykieta="Znak pisma">
          <input value={znakPisma} onChange={(e) => setZnakPisma(e.target.value)} />
        </Pole>
        <Pole etykieta="Data nadania">
          <input type="date" value={dataNadania} onChange={(e) => setDataNadania(e.target.value)} />
        </Pole>
        <Pole etykieta="Data doręczenia">
          <input
            type="date"
            value={dataDoreczenia}
            onChange={(e) => setDataDoreczenia(e.target.value)}
          />
        </Pole>
      </div>

      <div className="siatka">
        <Pole etykieta="Kanał korespondencji"><select value={kanal} onChange={(e) => setKanal(e.target.value as KanalPisma | '')}>
          <option value="">Nieokreślony</option>
          {Object.entries(nazwyKanalow).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></Pole>
        <Pole etykieta="Numer nadania / identyfikator przesyłki"><input value={numerNadania} onChange={(e) => setNumerNadania(e.target.value)} /></Pole>
        <Pole etykieta="Odpowiedź na pismo"><select value={poprzednieId} onChange={(e) => setPoprzednieId(e.target.value)}>
          <option value="">Pismo rozpoczynające wątek / bez powiązania</option>
          {pisma.map((pismo) => <option key={pismo.id} value={pismo.id}>#{pismo.id} {pismo.rodzaj} — {pismo.korespondent}</option>)}
        </select></Pole>
      </div>

      <div className="siatka">
        <Pole etykieta="Reguła terminu">
          <select value={regulaId} onChange={(e) => setRegulaId(e.target.value)}>
            <option value="">Bez wyznaczania terminu</option>
            {reguly.map((regula) => (
              <option key={regula.id} value={regula.id}>
                {regula.nazwa} — {regula.liczbaDni}{' '}
                {regula.sposobLiczenia === 'dni_robocze' ? 'dni roboczych' : 'dni'}
              </option>
            ))}
          </select>
        </Pole>
        <Pole etykieta="Czynność (domyślnie nazwa reguły)">
          <input value={czynnosc} onChange={(e) => setCzynnosc(e.target.value)} />
        </Pole>
      </div>

      {wybranaRegula && (
        <p className="wskazowka">
          Termin liczony od daty{' '}
          {wybranaRegula.zdarzeniePoczatkowe === 'doreczenie' ? 'doręczenia' : 'nadania'};{' '}
          {wybranaRegula.przesuwajDniWolne
            ? 'termin przypadający na dzień wolny przesuwa się na najbliższy dzień roboczy'
            : 'termin nie jest przesuwany z dnia wolnego'}
          . Bez daty {wybranaRegula.zdarzeniePoczatkowe === 'doreczenie' ? 'doręczenia' : 'nadania'}{' '}
          pismo zapisze się bez terminu.
        </p>
      )}

      <button type="submit">Zapisz pismo</button>
    </form>
  );
}
