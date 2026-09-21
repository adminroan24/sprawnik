/**
 * Dane demonstracyjne — kilka spraw wraz z korespondencją i terminami.
 *
 * Skrypt przechodzi przez warstwę dziedzinową, a nie przez zapis wprost do
 * bazy: terminy powstają tym samym mechanizmem, co przy pracy z aplikacją,
 * więc dane pokazują rzeczywiste działanie reguł, a nie wartości wpisane ręcznie.
 *
 * Użycie: npm run demo -- <e-mail konta>
 */

import * as sprawyDb from '../db/sprawy.js';
import * as regulyDb from '../db/reguly.js';
import * as uzytkownicy from '../db/uzytkownicy.js';
import { zarejestrujPismo } from '../services/rejestracja.js';
import { closePool } from '../db/pool.js';

const email = process.argv[2];
if (!email) {
  console.error('Użycie: npm run demo -- <e-mail konta>');
  process.exit(1);
}

const konto = await uzytkownicy.znajdzPoEmailu(email);
if (!konto) {
  console.error(`Konto ${email} nie istnieje — utwórz je poleceniem npm run konto`);
  process.exit(1);
}

const reguly = await regulyDb.lista();
const regula = (nazwa: string) => {
  const znaleziona = reguly.find((pozycja) => pozycja.nazwa === nazwa);
  if (!znaleziona) throw new Error(`Brak reguły: ${nazwa}`);
  return znaleziona.id;
};

/** Data przesunięta o wskazaną liczbę dni względem dzisiaj — dane zachowują aktualność. */
const dzien = (przesuniecie: number): string =>
  new Date(Date.now() + przesuniecie * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const definicje = [
  {
    sprawa: {
      tytul: 'Odwołanie od decyzji o warunkach zabudowy',
      organ: 'Urząd Miasta Warszawy, Wydział Architektury',
      znakWlasny: 'WZ/2026/14',
      dataWszczecia: dzien(-49),
      opis: 'Postępowanie w sprawie ustalenia warunków zabudowy dla działki przy ul. Polnej.',
    },
    pisma: [
      {
        kierunek: 'przychodzace' as const,
        rodzaj: 'Decyzja o odmowie ustalenia warunków zabudowy',
        korespondent: 'Urząd Miasta Warszawy',
        znakPisma: 'AM-WZ.6730.214.2026',
        dataNadania: dzien(-12),
        dataDoreczenia: dzien(-9),
        regula: 'Odwołanie od decyzji',
        czynnosc: 'Wniesienie odwołania od decyzji odmownej',
      },
      {
        kierunek: 'wychodzace' as const,
        rodzaj: 'Wniosek o wydanie kopii akt',
        korespondent: 'Urząd Miasta Warszawy',
        znakPisma: null,
        dataNadania: dzien(-7),
        dataDoreczenia: null,
        regula: null,
        czynnosc: null,
      },
    ],
  },
  {
    sprawa: {
      tytul: 'Postępowanie podatkowe — korekta deklaracji',
      organ: 'Naczelnik Urzędu Skarbowego Warszawa-Śródmieście',
      znakWlasny: 'US/2026/3',
      dataWszczecia: dzien(-95),
      opis: 'Wezwanie do złożenia wyjaśnień w sprawie korekty deklaracji za 2025 rok.',
    },
    pisma: [
      {
        kierunek: 'przychodzace' as const,
        rodzaj: 'Wezwanie do złożenia wyjaśnień',
        korespondent: 'Urząd Skarbowy Warszawa-Śródmieście',
        znakPisma: '1471-SOP.4103.88.2026',
        dataNadania: dzien(-30),
        dataDoreczenia: dzien(-26),
        regula: 'Odpowiedź na wezwanie do wyjaśnień',
        czynnosc: 'Złożenie wyjaśnień wraz z dokumentacją',
      },
      {
        kierunek: 'przychodzace' as const,
        rodzaj: 'Postanowienie o przedłużeniu terminu',
        korespondent: 'Urząd Skarbowy Warszawa-Śródmieście',
        znakPisma: '1471-SOP.4103.88.2026/2',
        dataNadania: dzien(-4),
        dataDoreczenia: null,
        regula: 'Zażalenie na postanowienie',
        czynnosc: 'Wniesienie zażalenia na postanowienie',
      },
    ],
  },
  {
    sprawa: {
      tytul: 'Wpis do rejestru zabytków — nieruchomość przy ul. Starej 8',
      organ: 'Mazowiecki Wojewódzki Konserwator Zabytków',
      znakWlasny: 'MWKZ/2026/2',
      dataWszczecia: dzien(-20),
      opis: 'Postępowanie wszczęte z urzędu w sprawie wpisu budynku do rejestru zabytków.',
    },
    pisma: [
      {
        kierunek: 'przychodzace' as const,
        rodzaj: 'Zawiadomienie o wszczęciu postępowania',
        korespondent: 'Mazowiecki Wojewódzki Konserwator Zabytków',
        znakPisma: 'WRE.5130.41.2026',
        dataNadania: dzien(-18),
        dataDoreczenia: dzien(-15),
        regula: 'Uzupełnienie braków formalnych',
        czynnosc: 'Zgłoszenie uwag do zawiadomienia',
      },
    ],
  },
];

try {
  for (const definicja of definicje) {
    const sprawa = await sprawyDb.dodaj({
      uzytkownikId: konto.id,
      tytul: definicja.sprawa.tytul,
      organ: definicja.sprawa.organ,
      znakWlasny: definicja.sprawa.znakWlasny,
      dataWszczecia: definicja.sprawa.dataWszczecia,
      opis: definicja.sprawa.opis,
    });

    for (const pismo of definicja.pisma) {
      const wynik = await zarejestrujPismo(sprawa.id, {
        kierunek: pismo.kierunek,
        rodzaj: pismo.rodzaj,
        korespondent: pismo.korespondent,
        znakPisma: pismo.znakPisma,
        dataNadania: pismo.dataNadania,
        dataDoreczenia: pismo.dataDoreczenia,
        opis: null,
        regulaId: pismo.regula ? regula(pismo.regula) : null,
        czynnosc: pismo.czynnosc,
      });

      const opisTerminu = wynik.termin
        ? `termin ${wynik.termin.dataUplywu}`
        : `bez terminu (${wynik.powodBrakuTerminu})`;
      console.log(`  ${pismo.rodzaj} — ${opisTerminu}`);
    }

    console.log(`Utworzono sprawę: ${sprawa.tytul}`);
  }
} finally {
  await closePool();
}
