import { useState } from 'react';
import { api } from '../api/client';
import { Komunikat } from './wspolne';
import type { RolaDokumentu } from '../typy';

export function Skaner({ pismoId, rola, poDodaniu }: {
  pismoId: number | null; rola: RolaDokumentu; poDodaniu: () => Promise<void>;
}) {
  const [skanery, setSkanery] = useState<{ id: string; nazwa: string }[]>([]);
  const [urzadzenie, setUrzadzenie] = useState('');
  const [dpi, setDpi] = useState(200);
  const [zajety, setZajety] = useState(false);
  const [blad, setBlad] = useState<unknown>(null);
  const [komunikat, setKomunikat] = useState('');

  async function odswiez() {
    setZajety(true); setBlad(null); setKomunikat('');
    try {
      const dane = await api.pobierz<{ wlaczone: boolean; skanery: { id: string; nazwa: string }[] }>('/skanery');
      setSkanery(dane.skanery);
      setUrzadzenie(dane.skanery[0]?.id ?? '');
      if (!dane.wlaczone) setKomunikat('Skanowanie nie jest włączone dla tej instalacji.');
      else if (!dane.skanery.length) setKomunikat('Nie znaleziono dostępnego skanera. Sprawdź połączenie i odśwież listę.');
    } catch (problem) { setBlad(problem); } finally { setZajety(false); }
  }

  async function skanuj() {
    if (!pismoId || !urzadzenie) return;
    setZajety(true); setBlad(null); setKomunikat('Trwa skanowanie kartki…');
    try {
      await api.wyslij(`/pisma/${pismoId}/skan`, { urzadzenie, dpi, rola });
      setKomunikat('Skan został dołączony do wybranego pisma. Możesz odczytać jego tekst przyciskiem OCR.');
      await poDodaniu();
    } catch (problem) { setKomunikat(''); setBlad(problem); } finally { setZajety(false); }
  }

  return <div className="karta formularz">
    <h4>Skaner podłączony do komputera</h4>
    <p className="drobne">Wybierz wyżej pismo i rodzaj dokumentu. Włóż kartkę do skanera; jeden skan zapisze jeden obraz PNG.</p>
    <Komunikat blad={blad} />
    {komunikat && <p role="status">{komunikat}</p>}
    <div className="filtry">
      <button type="button" className="drugorzedny" disabled={zajety} onClick={odswiez}>Odśwież skanery</button>
      <select aria-label="Skaner" value={urzadzenie} disabled={zajety} onChange={(e) => setUrzadzenie(e.target.value)}>
        <option value="">Wybierz urządzenie</option>
        {skanery.map((skaner) => <option key={skaner.id} value={skaner.id}>{skaner.nazwa}</option>)}
      </select>
      <select aria-label="Rozdzielczość skanu" value={dpi} disabled={zajety} onChange={(e) => setDpi(Number(e.target.value))}>
        {[150, 200, 300].map((value) => <option key={value} value={value}>{value} dpi</option>)}
      </select>
      <button type="button" disabled={zajety || !pismoId || !urzadzenie} onClick={skanuj}>
        {zajety ? 'Proszę czekać…' : 'Skanuj kartkę'}
      </button>
    </div>
  </div>;
}
