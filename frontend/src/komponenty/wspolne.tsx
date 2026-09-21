import type { ReactNode } from 'react';
import { BladApi } from '../api/client';
import type { StanTerminu, StatusSprawy, StatusTerminu } from '../typy';

const NAZWY_STANOW: Record<StanTerminu, string> = {
  przekroczony: 'przekroczony',
  zblizajacy_sie: 'zbliża się',
  odlegly: 'odległy',
};

const NAZWY_STATUSOW_SPRAWY: Record<StatusSprawy, string> = {
  w_toku: 'w toku',
  zawieszona: 'zawieszona',
  zakonczona: 'zakończona',
};

const NAZWY_STATUSOW_TERMINU: Record<StatusTerminu, string> = {
  otwarty: 'otwarty',
  wykonany: 'wykonany',
  anulowany: 'anulowany',
};

export const nazwaStatusuSprawy = (status: StatusSprawy) => NAZWY_STATUSOW_SPRAWY[status];
export const nazwaStatusuTerminu = (status: StatusTerminu) => NAZWY_STATUSOW_TERMINU[status];

/** Data w zapisie dziennym. Wartość pusta oznacza zdarzenie, które nie nastąpiło. */
export function Data({ wartosc }: { wartosc: string | null }) {
  if (!wartosc) return <span className="brak">—</span>;
  const [rok, miesiac, dzien] = wartosc.split('-');
  return <span>{`${dzien}.${miesiac}.${rok}`}</span>;
}

/**
 * Oznaczenie stanu terminu. Stan nie jest przechowywany w bazie — przychodzi
 * z serwera wyliczony na dzień dzisiejszy, a tutaj wpływa wyłącznie na wygląd.
 */
export function ZnacznikStanu({ stan, dni }: { stan: StanTerminu | null; dni: number }) {
  if (!stan) return null;
  const opis =
    stan === 'przekroczony'
      ? `${NAZWY_STANOW[stan]} o ${Math.abs(dni)} dni`
      : stan === 'zblizajacy_sie'
        ? dni === 0
          ? 'upływa dzisiaj'
          : `${NAZWY_STANOW[stan]} — ${dni} dni`
        : `${NAZWY_STANOW[stan]} — ${dni} dni`;
  return <span className={`znacznik ${stan}`}>{opis}</span>;
}

export function Komunikat({ blad }: { blad: unknown }) {
  if (!blad) return null;
  const tresc = blad instanceof Error ? blad.message : 'Wystąpił nieznany błąd';
  const szczegoly = blad instanceof BladApi ? blad.szczegoly : [];
  return (
    <div className="komunikat blad" role="alert">
      <strong>{tresc}</strong>
      {szczegoly.length > 0 && (
        <ul>
          {szczegoly.map((problem) => (
            <li key={problem.pole}>
              {problem.pole}: {problem.komunikat}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Pole({ etykieta, children }: { etykieta: string; children: ReactNode }) {
  return (
    <label className="pole">
      <span>{etykieta}</span>
      {children}
    </label>
  );
}

export function Pusto({ tresc }: { tresc: string }) {
  return <p className="pusto">{tresc}</p>;
}
