/** Typy odpowiedzi API. Odpowiadają kształtowi danych zwracanych przez warstwę serwerową. */

export type Rola = 'uzytkownik' | 'administrator';
export type StatusSprawy = 'w_toku' | 'zawieszona' | 'zakonczona';
export type KierunekPisma = 'przychodzace' | 'wychodzace';
export type KanalPisma = 'email' | 'edoreczenia' | 'epuap' | 'poczta' | 'osobiscie' | 'inne';
export type RolaDokumentu = 'tresc' | 'zalacznik' | 'dowod_nadania' | 'potwierdzenie_odbioru';
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
  kanal: KanalPisma | null;
  numerNadania: string | null;
  odpowiedzNaPismoId: number | null;
};

export type Dokument = {
  id: number;
  pismoId: number;
  nazwaOryginalna: string;
  typMime: string;
  rozmiarBajtow: number;
  sumaKontrolna: string;
  dodano: string;
  rola: RolaDokumentu;
  ocrGotowy: boolean;
};

export type WynikOcr = { tekst: string; jezyki: string; liczbaStron: number; wykonano: string };

export const nazwyKanalow: Record<KanalPisma, string> = {
  email: 'E-mail', edoreczenia: 'e-Doręczenia', epuap: 'ePUAP', poczta: 'Poczta', osobiscie: 'Osobiście', inne: 'Inny',
};
export const nazwyRolDokumentow: Record<RolaDokumentu, string> = {
  tresc: 'Treść pisma', zalacznik: 'Załącznik', dowod_nadania: 'Dowód nadania', potwierdzenie_odbioru: 'Potwierdzenie odbioru',
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

export type UstawieniaTerminuSkanu = { zrodlo: 'reczny' | 'ocr'; fragment: string } & (
  { tryb: 'dni'; liczbaDni: number; sposobLiczenia: 'dni_kalendarzowe' | 'dni_robocze'; przesuwajDniWolne: boolean; dataPoczatkowa: string | null } |
  { tryb: 'data'; dataUplywu: string }
);
export type TerminSkanu = { ustawienia: UstawieniaTerminuSkanu; dataPoczatkowa: string; dataUplywu: string;
  dataUplywuPrzedPrzesunieciem: string; ostrzezenie: string | null };
export type PropozycjaTerminuSkanu = { ustawienia: UstawieniaTerminuSkanu; podstawa: 'wplyw' | 'inna' | 'data'; fragment: string };
