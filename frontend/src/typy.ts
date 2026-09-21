/** Typy odpowiedzi API. Odpowiadają kształtowi danych zwracanych przez warstwę serwerową. */

export type Rola = 'uzytkownik' | 'administrator';
export type StatusSprawy = 'w_toku' | 'zawieszona' | 'zakonczona';
export type KierunekPisma = 'przychodzace' | 'wychodzace';
export type StatusTerminu = 'otwarty' | 'wykonany' | 'anulowany';
export type StanTerminu = 'odlegly' | 'zblizajacy_sie' | 'przekroczony';

export type Uzytkownik = {
  id: number;
  email: string;
  imieNazwisko: string;
  rola: Rola;
};

export type Sprawa = {
  id: number;
  tytul: string;
  znakWlasny: string | null;
  organ: string | null;
  status: StatusSprawy;
  dataWszczecia: string | null;
  opis: string | null;
};

export type SprawaNaLiscie = Sprawa & {
  liczbaPism: number;
  liczbaTerminowOtwartych: number;
  najblizszyTermin: string | null;
};

export type Pismo = {
  id: number;
  sprawaId: number;
  kierunek: KierunekPisma;
  rodzaj: string;
  korespondent: string;
  znakPisma: string | null;
  dataNadania: string | null;
  dataDoreczenia: string | null;
  opis: string | null;
};

export type Termin = {
  id: number;
  sprawaId: number;
  pismoId: number | null;
  regulaId: number | null;
  czynnosc: string;
  dataPoczatkowa: string;
  dataUplywu: string;
  sposobWyznaczenia: 'automatyczny' | 'reczny';
  status: StatusTerminu;
  dataWykonania: string | null;
  tytulSprawy: string;
  nazwaReguly: string | null;
  stan: StanTerminu | null;
  dniDoUplywu: number;
};

export type Regula = {
  id: number;
  nazwa: string;
  liczbaDni: number;
  sposobLiczenia: 'dni_kalendarzowe' | 'dni_robocze';
  zdarzeniePoczatkowe: 'doreczenie' | 'nadanie';
  przesuwajDniWolne: boolean;
  opis: string | null;
};

export type ZdarzenieChronologii = {
  data: string;
  rodzaj: 'pismo' | 'termin' | 'dokument';
  opis: string;
};

export type SzczegolySprawy = {
  sprawa: Sprawa;
  pisma: Pismo[];
  terminy: Termin[];
  chronologia: ZdarzenieChronologii[];
};

export type WynikRejestracjiPisma = {
  pismo: Pismo;
  termin: Termin | null;
  powodBrakuTerminu: string | null;
};
