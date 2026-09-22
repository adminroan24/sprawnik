/**
 * Warstwa dziedzinowa rejestru: sprawy, pisma i powstające z nich terminy.
 *
 * Moduł łączy silnik terminów z zapisem danych, ale nie zna protokołu HTTP —
 * trasy przekazują mu gotowe wartości i otrzymują wynik operacji.
 */

import { wTransakcji } from '../db/pool.js';
import * as pismaDb from '../db/pisma.js';
import * as terminyDb from '../db/terminy.js';
import * as regulyDb from '../db/reguly.js';
import { wczytajKalendarz } from '../db/kalendarz.js';
import { BladZadania, bladBrakZasobu, bladWalidacji } from '../middleware/errors.js';
import { dataBiegu, wyznaczTermin } from './terminy.js';
import type { Pismo } from '../db/pisma.js';
import type { Termin } from '../db/terminy.js';

export type DanePisma = {
  kierunek: pismaDb.KierunekPisma;
  rodzaj: string;
  korespondent: string;
  znakPisma: string | null;
  dataNadania: string | null;
  dataDoreczenia: string | null;
  opis: string | null;
  /** Reguła, według której ma powstać termin. Bez niej pismo rejestruje się bez terminu. */
  regulaId: number | null;
  /** Nazwa czynności, której termin dotyczy. Domyślnie nazwa reguły. */
  czynnosc: string | null;
};

export type WynikRejestracji = {
  pismo: Pismo;
  termin: Termin | null;
  /** Wyjaśnienie, dlaczego termin nie powstał — prezentowane użytkownikowi. */
  powodBrakuTerminu: string | null;
};

/**
 * Rejestracja pisma wraz z wyznaczeniem terminu (UC3, UC4 oraz zawierany UC7).
 *
 * Termin powstaje tylko wtedy, gdy wskazano regułę i nastąpiło zdarzenie, od
 * którego biegnie. Brak daty doręczenia nie jest błędem — pismo bywa rejestrowane
 * wcześniej niż dociera potwierdzenie odbioru. Liczenie terminu od daty nadania
 * dałoby wynik zaniżony, czyli błędny w sposób niebezpieczny dla użytkownika.
 */
export async function zarejestrujPismo(
  sprawaId: number,
  dane: DanePisma,
): Promise<WynikRejestracji> {
  const regula = dane.regulaId === null ? null : await regulyDb.znajdz(dane.regulaId);
  if (dane.regulaId !== null && !regula) {
    throw bladBrakZasobu('Wskazana reguła terminu nie istnieje');
  }

  return wTransakcji(async (wykonawca) => {
    const pismo = await pismaDb.dodaj({ sprawaId, ...dane }, wykonawca);

    if (!regula) {
      return { pismo, termin: null, powodBrakuTerminu: 'Nie wskazano reguły terminu' };
    }

    const poczatek = dataBiegu(regula.zdarzeniePoczatkowe, pismo);
    if (!poczatek) {
      return {
        pismo,
        termin: null,
        powodBrakuTerminu:
          regula.zdarzeniePoczatkowe === 'doreczenie'
            ? 'Pismo oczekuje na potwierdzenie doręczenia — ' +
              'termin powstanie po uzupełnieniu daty'
            : 'Brak daty nadania, od której biegnie termin',
      };
    }

    const termin = await zapiszTerminZReguly(
      { sprawaId, pismoId: pismo.id, czynnosc: dane.czynnosc },
      regula,
      poczatek,
      wykonawca,
    );

    return { pismo, termin, powodBrakuTerminu: null };
  });
}

/**
 * Uzupełnienie daty doręczenia pisma zarejestrowanego wcześniej (przebieg
 * alternatywny UC3). Dopiero to zdarzenie pozwala wyznaczyć termin, który
 * w chwili rejestracji nie mógł powstać.
 */
export async function uzupelnijDoreczenie(
  pismoId: number,
  dataDoreczenia: string,
  regulaId: number | null,
  czynnosc: string | null,
): Promise<WynikRejestracji> {
  const pismo = await pismaDb.znajdz(pismoId);
  if (!pismo) throw bladBrakZasobu('Pismo nie istnieje');
  if (pismo.dataDoreczenia) {
    throw bladWalidacji('Pismo ma już zapisaną datę doręczenia');
  }
  if (pismo.dataNadania && dataDoreczenia < pismo.dataNadania) {
    throw bladWalidacji('Data doręczenia nie może poprzedzać daty nadania');
  }

  const regula = regulaId === null ? null : await regulyDb.znajdz(regulaId);
  if (regulaId !== null && !regula) {
    throw bladBrakZasobu('Wskazana reguła terminu nie istnieje');
  }

  return wTransakcji(async (wykonawca) => {
    const zaktualizowane = await pismaDb.ustawDateDoreczenia(pismoId, dataDoreczenia);
    if (!zaktualizowane) throw bladBrakZasobu('Pismo nie istnieje');

    if (!regula) {
      return {
        pismo: zaktualizowane,
        termin: null,
        powodBrakuTerminu: 'Nie wskazano reguły terminu',
      };
    }

    const poczatek = dataBiegu(regula.zdarzeniePoczatkowe, zaktualizowane);
    if (!poczatek) {
      return {
        pismo: zaktualizowane,
        termin: null,
        powodBrakuTerminu: 'Brak daty, od której biegnie termin',
      };
    }

    const termin = await zapiszTerminZReguly(
      { sprawaId: zaktualizowane.sprawaId, pismoId: zaktualizowane.id, czynnosc },
      regula,
      poczatek,
      wykonawca,
    );

    return { pismo: zaktualizowane, termin, powodBrakuTerminu: null };
  });
}

/**
 * Termin wprowadzony ręcznie — dla czynności, dla której nie ma reguły
 * (przebieg alternatywny UC3). Pozostaje oznaczony jako wyznaczony ręcznie
 * i nie odwołuje się do reguły, bo żadna nie była podstawą wyliczenia.
 */
export async function dodajTerminReczny(dane: {
  sprawaId: number;
  pismoId: number | null;
  czynnosc: string;
  dataPoczatkowa: string;
  dataUplywu: string;
}): Promise<Termin> {
  if (dane.dataUplywu < dane.dataPoczatkowa) {
    throw bladWalidacji('Termin nie może upływać przed rozpoczęciem biegu');
  }
  return terminyDb.dodaj({
    sprawaId: dane.sprawaId,
    pismoId: dane.pismoId,
    regulaId: null,
    czynnosc: dane.czynnosc,
    dataPoczatkowa: dane.dataPoczatkowa,
    dataUplywu: dane.dataUplywu,
    sposobWyznaczenia: 'reczny',
  });
}

/** Zastosowanie reguły do daty początkowej i zapis terminu wraz ze śladem pochodzenia (UC7). */
async function zapiszTerminZReguly(
  kontekst: { sprawaId: number; pismoId: number; czynnosc: string | null },
  regula: regulyDb.Regula,
  dataPoczatkowa: string,
  wykonawca: Parameters<typeof terminyDb.dodaj>[1],
): Promise<Termin> {
  if (!regula.aktywna) {
    throw new BladZadania(400, 'Reguła terminu jest nieaktywna');
  }

  const kalendarz = await wczytajKalendarz();
  const wyliczenie = wyznaczTermin(
    {
      liczbaDni: regula.liczbaDni,
      sposobLiczenia: regula.sposobLiczenia,
      zdarzeniePoczatkowe: regula.zdarzeniePoczatkowe,
      przesuwajDniWolne: regula.przesuwajDniWolne,
    },
    dataPoczatkowa,
    kalendarz,
  );

  return terminyDb.dodaj(
    {
      sprawaId: kontekst.sprawaId,
      pismoId: kontekst.pismoId,
      regulaId: regula.id,
      czynnosc: kontekst.czynnosc?.trim() || regula.nazwa,
      dataPoczatkowa: wyliczenie.dataPoczatkowa,
      dataUplywu: wyliczenie.dataUplywu,
      sposobWyznaczenia: 'automatyczny',
    },
    wykonawca,
  );
}
