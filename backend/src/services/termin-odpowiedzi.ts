import { z } from 'zod';
import { wyznaczTermin, type Kalendarz } from './terminy.js';

export function poprawnaData(data: string): boolean {
  const d = new Date(`${data}T00:00:00.000Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(data) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === data;
}
const data = z.string().refine(poprawnaData, 'Podaj istniejącą datę w formacie RRRR-MM-DD');
const wspolne = { zrodlo: z.enum(['reczny', 'ocr']).default('reczny'), fragment: z.string().max(500).default('') };
export const ustawieniaTerminu = z.discriminatedUnion('tryb', [
  z.object({ ...wspolne, tryb: z.literal('dni'), liczbaDni: z.number().int().min(1).max(365),
    sposobLiczenia: z.enum(['dni_kalendarzowe', 'dni_robocze']).default('dni_kalendarzowe'),
    przesuwajDniWolne: z.boolean().default(false), dataPoczatkowa: data.nullable().default(null) }),
  z.object({ ...wspolne, tryb: z.literal('data'), dataUplywu: data }),
]);
export type UstawieniaTerminu = z.infer<typeof ustawieniaTerminu>;
export type TerminZeSkanu = { ustawienia: UstawieniaTerminu; dataPoczatkowa: string; dataUplywu: string;
  dataUplywuPrzedPrzesunieciem: string; ostrzezenie: string | null };

export function wyliczTerminOdpowiedzi(ustawienia: UstawieniaTerminu, dataWplywu: string, kalendarz: Kalendarz): TerminZeSkanu {
  let wynik;
  if (ustawienia.tryb === 'data') {
    // Stała data nie określa biegu od doręczenia. W rejestrze jest zdarzeniem jednodniowym.
    wynik = { dataPoczatkowa: ustawienia.dataUplywu, dataUplywu: ustawienia.dataUplywu,
      dataUplywuPrzedPrzesunieciem: ustawienia.dataUplywu };
  } else {
    wynik = wyznaczTermin({ ...ustawienia, zdarzeniePoczatkowe: 'doreczenie' }, ustawienia.dataPoczatkowa ?? dataWplywu, kalendarz);
  }
  return { ustawienia, ...wynik, ostrzezenie: wynik.dataUplywu < dataWplywu ?
    'Termin wskazany w piśmie jest wcześniejszy niż data wpływu. Sprawdź oryginał; program nie zmienił tej daty.' : null };
}

export type PropozycjaTerminu = { ustawienia: UstawieniaTerminu; podstawa: 'wplyw' | 'inna' | 'data'; fragment: string };
const slowa: Record<string, number> = { jednego: 1, dwoch: 2, trzech: 3, czterech: 4, pieciu: 5,
  szesciu: 6, siedmiu: 7, osmiu: 8, dziewieciu: 9, dziesieciu: 10, czternastu: 14, dwudziestu: 20, trzydziestu: 30 };
const normalizuj = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase();

/** Propozycje z przytoczeniem źródła; żaden odczyt nie staje się terminem bez zatwierdzenia. */
export function odczytajTerminyOdpowiedzi(tekst: string): PropozycjaTerminu[] {
  const oryginal = tekst.replace(/\s+/g, ' ');
  const t = normalizuj(oryginal);
  const propozycje: PropozycjaTerminu[] = [];
  const dodaj = (indeks: number, koniec: number, ustawienia: UstawieniaTerminu, podstawa: PropozycjaTerminu['podstawa']) => {
    const fragment = oryginal.slice(Math.max(0, indeks - 100), Math.min(oryginal.length, koniec + 140));
    const otoczenie = normalizuj(fragment);
    // Pouczenie o zaskarżeniu nie jest żądaniem odpowiedzi lub wykonania wezwania.
    if (/odwolan|zazalen|wniesieni.{0,8}skarg/.test(otoczenie)) return;
    if (!/wezw|odpowied|wyjasn|uzupeln|przedloz|nadesl|przesl|dostarcz|zloz|zapl|przekaz|kwot/.test(otoczenie)) return;
    const dane = { ...ustawienia, fragment };
    if (!propozycje.some(p => JSON.stringify({ ...p.ustawienia, fragment: '' }) === JSON.stringify({ ...dane, fragment: '' }))) {
      propozycje.push({ ustawienia: dane, podstawa, fragment });
    }
  };
  const dni = /(?:w\s+terminie|w\s+ciagu|termin\s+wynosi)\s+(\d{1,3}|[a-z]+)\s*(?:\([a-z ]+\)\s*)?dni(?:a)?(\s+roboczych)?/g;
  for (const m of t.matchAll(dni)) {
    const n = /^\d+$/.test(m[1]!) ? Number(m[1]) : slowa[m[1]!];
    if (!n || n > 365) continue;
    const po = t.slice(m.index! + m[0].length, m.index! + m[0].length + 110);
    const podstawa = /od\s+(?:dnia\s+|daty\s+)?(?:doreczenia|otrzymania|odbioru|wplywu)/.test(po) ? 'wplyw' : 'inna';
    dodaj(m.index!, m.index! + m[0].length, { tryb: 'dni', liczbaDni: n,
      sposobLiczenia: m[2] ? 'dni_robocze' : 'dni_kalendarzowe', przesuwajDniWolne: false,
      dataPoczatkowa: null, zrodlo: 'ocr', fragment: '' }, podstawa);
  }
  const daty = /(?:do\s+(?:dnia\s+)?|najpozniej\s+(?:do\s+)?)(\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{4})(?!\d)/g;
  for (const m of t.matchAll(daty)) {
    const czesci = m[1]!.split(/[./-]/);
    const iso = czesci[0]!.length === 4 ? m[1]! : `${czesci[2]}-${czesci[1]!.padStart(2, '0')}-${czesci[0]!.padStart(2, '0')}`;
    if (poprawnaData(iso)) dodaj(m.index!, m.index! + m[0].length, { tryb: 'data', dataUplywu: iso, zrodlo: 'ocr', fragment: '' }, 'data');
  }
  return propozycje;
}
