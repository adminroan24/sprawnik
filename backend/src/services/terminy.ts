/**
 * Silnik wyznaczania terminów — warstwa dziedzinowa.
 *
 * Moduł celowo nie zna bazy danych ani protokołu HTTP: przyjmuje regułę, datę
 * początkową i kalendarz dni ustawowo wolnych, a zwraca wyliczony termin.
 * Dzięki temu daje się sprawdzić testem bez uruchamiania serwera (sekcja 2.3
 * dokumentacji — rozdzielenie warstw).
 *
 * Daty reprezentowane są łańcuchami ISO (RRRR-MM-DD) i przeliczane w strefie
 * UTC. Termin jest datą dzienną, więc doba lokalna i przesunięcia czasu letniego
 * nie mają dla niego znaczenia, a liczenie w UTC chroni przed przesunięciem
 * wyniku o dzień przy zmianie czasu.
 */

export type SposobLiczenia = 'dni_kalendarzowe' | 'dni_robocze';
export type ZdarzeniePoczatkowe = 'doreczenie' | 'nadanie';
export type StanTerminu = 'odlegly' | 'zblizajacy_sie' | 'przekroczony';

/** Reguła terminu — dane odczytane z tabeli `regula_terminu`. */
export type RegulaTerminu = {
  liczbaDni: number;
  sposobLiczenia: SposobLiczenia;
  zdarzeniePoczatkowe: ZdarzeniePoczatkowe;
  przesuwajDniWolne: boolean;
};

/** Zbiór dat ustawowo wolnych w postaci ISO. Soboty i niedziele nie są w nim zapisywane. */
export type Kalendarz = ReadonlySet<string>;

export type WyliczonyTermin = {
  dataPoczatkowa: string;
  /** Data upływu przed ewentualnym przesunięciem — zachowana, aby wyliczenie dało się prześledzić. */
  dataUplywuPrzedPrzesunieciem: string;
  dataUplywu: string;
  przesunieto: boolean;
};

const MILISEKUNDY_DOBY = 24 * 60 * 60 * 1000;

function naDate(iso: string): Date {
  const data = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(data.getTime())) {
    throw new Error(`Nieprawidłowa data: ${iso}`);
  }
  return data;
}

function naIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function przesun(data: Date, oDni: number): Date {
  return new Date(data.getTime() + oDni * MILISEKUNDY_DOBY);
}

/**
 * Dzień wolny to sobota, niedziela albo dzień ustawowo wolny.
 * Weekend rozpoznawany jest z samej daty — kalendarz zawiera wyłącznie dni ustawowe.
 */
export function czyDzienWolny(iso: string, kalendarz: Kalendarz): boolean {
  const dzienTygodnia = naDate(iso).getUTCDay();
  return dzienTygodnia === 0 || dzienTygodnia === 6 || kalendarz.has(iso);
}

export function czyDzienRoboczy(iso: string, kalendarz: Kalendarz): boolean {
  return !czyDzienWolny(iso, kalendarz);
}

/**
 * Najbliższy dzień roboczy nie wcześniejszy niż podany.
 *
 * Przesunięcie wykonuje się krokami naprzód aż do skutku, a nie o jeden dzień:
 * po dniu ustawowo wolnym bywa kolejny (25 i 26 grudnia) albo weekend
 * (Wielki Piątek, po którym następuje Poniedziałek Wielkanocny).
 */
export function najblizszyDzienRoboczy(iso: string, kalendarz: Kalendarz): string {
  let data = naDate(iso);
  let krokow = 0;
  while (czyDzienWolny(naIso(data), kalendarz)) {
    data = przesun(data, 1);
    if (++krokow > 400) {
      throw new Error('Nie znaleziono dnia roboczego — kalendarz dni wolnych jest błędny');
    }
  }
  return naIso(data);
}

/** Dodaje wskazaną liczbę dni roboczych, pomijając dni wolne po drodze. */
function dodajDniRobocze(od: Date, liczbaDni: number, kalendarz: Kalendarz): Date {
  let data = od;
  let pozostalo = liczbaDni;
  while (pozostalo > 0) {
    data = przesun(data, 1);
    if (czyDzienRoboczy(naIso(data), kalendarz)) {
      pozostalo -= 1;
    }
  }
  return data;
}

/**
 * Wyznacza termin przez zastosowanie reguły do daty początkowej (UC7).
 *
 * Bieg terminu rozpoczyna się dnia następnego po zdarzeniu początkowym, dlatego
 * liczba dni dodawana jest do daty zdarzenia. Przesunięcie z dnia wolnego
 * dotyczy wyłącznie dnia końcowego — nie zmienia liczby dni zapisanej w regule.
 */
export function wyznaczTermin(
  regula: RegulaTerminu,
  dataPoczatkowa: string,
  kalendarz: Kalendarz,
): WyliczonyTermin {
  if (!Number.isInteger(regula.liczbaDni) || regula.liczbaDni <= 0) {
    throw new Error('Reguła terminu musi wyznaczać dodatnią liczbę dni');
  }

  const poczatek = naDate(dataPoczatkowa);
  const koniec =
    regula.sposobLiczenia === 'dni_robocze'
      ? dodajDniRobocze(poczatek, regula.liczbaDni, kalendarz)
      : przesun(poczatek, regula.liczbaDni);

  const przedPrzesunieciem = naIso(koniec);
  const dataUplywu = regula.przesuwajDniWolne
    ? najblizszyDzienRoboczy(przedPrzesunieciem, kalendarz)
    : przedPrzesunieciem;

  return {
    dataPoczatkowa,
    dataUplywuPrzedPrzesunieciem: przedPrzesunieciem,
    dataUplywu,
    przesunieto: dataUplywu !== przedPrzesunieciem,
  };
}

/**
 * Wskazuje datę, od której biegnie termin dla danego pisma.
 * Zwraca null, gdy zdarzenie początkowe jeszcze nie nastąpiło — wtedy termin
 * nie powstaje, zamiast powstawać z daty zastępczej.
 */
export function dataBiegu(
  zdarzenie: ZdarzeniePoczatkowe,
  pismo: { dataNadania: string | null; dataDoreczenia: string | null },
): string | null {
  return zdarzenie === 'nadanie' ? pismo.dataNadania : pismo.dataDoreczenia;
}

/**
 * Kwalifikuje termin otwarty do jednego ze stanów ostrzegawczych (UC9).
 * Stan nie jest przechowywany w bazie — wynika z porównania z datą bieżącą,
 * więc zapisany dezaktualizowałby się nazajutrz.
 */
export function stanTerminu(
  dataUplywu: string,
  dzisiaj: string,
  progOstrzegania = 7,
): StanTerminu {
  const pozostalo = Math.round((naDate(dataUplywu).getTime() - naDate(dzisiaj).getTime()) / MILISEKUNDY_DOBY);
  if (pozostalo < 0) return 'przekroczony';
  if (pozostalo <= progOstrzegania) return 'zblizajacy_sie';
  return 'odlegly';
}
