/**
 * Testy silnika terminów. Uruchamiane bez serwera i bez bazy danych —
 * kalendarz podawany jest wprost, dzięki czemu każdy przypadek czyta się
 * w całości w jednym miejscu.
 *
 * Przypadki odpowiadają sytuacjom wskazanym w sekcji 2.2 dokumentacji jako te,
 * które obnażają implementację przesuwającą termin tylko o jeden dzień.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { najblizszyDzienRoboczy, stanTerminu, wyznaczTermin, type RegulaTerminu } from './terminy.js';

/** Wycinek kalendarza obejmujący dni wolne wykorzystywane w testach. */
const kalendarz = new Set([
  '2026-04-05', // Niedziela Wielkanocna
  '2026-04-06', // Poniedziałek Wielkanocny
  '2026-11-01', // Wszystkich Świętych (niedziela)
  '2026-12-24', // Wigilia (czwartek)
  '2026-12-25', // Boże Narodzenie (piątek)
  '2026-12-26', // drugi dzień świąt (sobota)
  '2027-12-24', // Wigilia (piątek)
  '2027-12-25',
  '2027-12-26',
  '2028-05-03', // Święto Narodowe Trzeciego Maja (środa)
  '2028-12-25', // Boże Narodzenie (poniedziałek)
  '2028-12-26',
]);

// Wielki Piątek nie występuje w kalendarzu — w Polsce nie jest dniem ustawowo
// wolnym od pracy. Ciąg dni wolnych wokół Wielkanocy zaczyna się dopiero
// w Wielką Sobotę.

const regula = (nadpisania: Partial<RegulaTerminu> = {}): RegulaTerminu => ({
  liczbaDni: 14,
  sposobLiczenia: 'dni_kalendarzowe',
  zdarzeniePoczatkowe: 'doreczenie',
  przesuwajDniWolne: true,
  ...nadpisania,
});

describe('wyznaczanie terminu w dniach kalendarzowych', () => {
  it('liczy od dnia następnego po zdarzeniu początkowym', () => {
    // 14 dni od doręczenia 1 czerwca 2026 (poniedziałek) upływa 15 czerwca (poniedziałek).
    const wynik = wyznaczTermin(regula(), '2026-06-01', kalendarz);
    assert.equal(wynik.dataUplywu, '2026-06-15');
    assert.equal(wynik.przesunieto, false);
  });

  it('zachowuje datę sprzed przesunięcia, aby wyliczenie dało się prześledzić', () => {
    const wynik = wyznaczTermin(regula({ liczbaDni: 7 }), '2026-06-05', kalendarz);
    assert.equal(wynik.dataUplywuPrzedPrzesunieciem, '2026-06-12');
    assert.equal(wynik.dataPoczatkowa, '2026-06-05');
  });

  it('odrzuca regułę z niedodatnią liczbą dni', () => {
    assert.throws(() => wyznaczTermin(regula({ liczbaDni: 0 }), '2026-06-01', kalendarz));
  });
});

describe('przesunięcie terminu przypadającego na dzień wolny', () => {
  it('z soboty przenosi na poniedziałek', () => {
    // 30 dni od doręczenia w czwartek 4 czerwca 2026 upływa w sobotę 4 lipca.
    const wynik = wyznaczTermin(regula({ liczbaDni: 30 }), '2026-06-04', kalendarz);
    assert.equal(wynik.dataUplywuPrzedPrzesunieciem, '2026-07-04');
    assert.equal(wynik.dataUplywu, '2026-07-06');
    assert.equal(wynik.przesunieto, true);
  });

  it('z niedzieli przenosi na poniedziałek', () => {
    // 30 dni od doręczenia w piątek 5 czerwca 2026 upływa w niedzielę 5 lipca.
    const wynik = wyznaczTermin(regula({ liczbaDni: 30 }), '2026-06-05', kalendarz);
    assert.equal(wynik.dataUplywuPrzedPrzesunieciem, '2026-07-05');
    assert.equal(wynik.dataUplywu, '2026-07-06');
  });

  it('z dnia ustawowo wolnego w środku tygodnia przenosi na następny dzień', () => {
    // 3 maja 2028 wypada w środę — termin przechodzi na czwartek 4 maja.
    assert.equal(najblizszyDzienRoboczy('2028-05-03', kalendarz), '2028-05-04');
  });

  it('przechodzi przez ciąg dni wolnych wokół Wielkanocy', () => {
    // Wielka Sobota, Niedziela Wielkanocna, Poniedziałek Wielkanocny — trzy dni z rzędu.
    assert.equal(najblizszyDzienRoboczy('2026-04-04', kalendarz), '2026-04-07');
  });

  it('przechodzi przez cztery dni wolne z rzędu na przełomie grudnia', () => {
    // 2026: Wigilia w czwartek, Boże Narodzenie w piątek, drugi dzień świąt
    // w sobotę, po nim niedziela. Pierwszym dniem roboczym jest poniedziałek.
    assert.equal(najblizszyDzienRoboczy('2026-12-24', kalendarz), '2026-12-28');
  });

  it('przechodzi przez oba dni Bożego Narodzenia', () => {
    // 25 grudnia 2028 to poniedziałek, 26 wtorek — pierwszym dniem roboczym jest 27.
    assert.equal(najblizszyDzienRoboczy('2028-12-25', kalendarz), '2028-12-27');
  });

  it('przechodzi przez dzień ustawowo wolny nałożony na weekend', () => {
    // Wigilia 2027 wypada w piątek, po niej sobota, niedziela i drugi dzień świąt.
    assert.equal(najblizszyDzienRoboczy('2027-12-24', kalendarz), '2027-12-27');
  });

  it('nie przesuwa terminu, gdy reguła tego nie przewiduje', () => {
    const wynik = wyznaczTermin(
      regula({ liczbaDni: 30, przesuwajDniWolne: false }),
      '2026-06-04',
      kalendarz,
    );
    assert.equal(wynik.dataUplywu, '2026-07-04'); // sobota pozostaje terminem
    assert.equal(wynik.przesunieto, false);
  });
});

describe('wyznaczanie terminu w dniach roboczych', () => {
  it('pomija weekendy przy liczeniu dni', () => {
    // 10 dni roboczych od poniedziałku 1 czerwca 2026 to poniedziałek 15 czerwca.
    const wynik = wyznaczTermin(
      regula({ liczbaDni: 10, sposobLiczenia: 'dni_robocze' }),
      '2026-06-01',
      kalendarz,
    );
    assert.equal(wynik.dataUplywu, '2026-06-15');
  });

  it('pomija dni ustawowo wolne przypadające w tygodniu', () => {
    // 5 dni roboczych od piątku 28 kwietnia 2028; 3 maja (środa) jest wolny,
    // więc termin przypada 8 maja zamiast 5 maja.
    const wynik = wyznaczTermin(
      regula({ liczbaDni: 5, sposobLiczenia: 'dni_robocze' }),
      '2028-04-28',
      kalendarz,
    );
    assert.equal(wynik.dataUplywu, '2028-05-08');
  });

  it('daje wynik przypadający zawsze na dzień roboczy', () => {
    // 3 dni robocze od środy 1 kwietnia 2026: czwartek, piątek, a następnie
    // wtorek — weekend i Poniedziałek Wielkanocny nie są liczone.
    const wynik = wyznaczTermin(
      regula({ liczbaDni: 3, sposobLiczenia: 'dni_robocze' }),
      '2026-04-01',
      kalendarz,
    );
    assert.equal(wynik.dataUplywu, '2026-04-07');
    assert.equal(wynik.przesunieto, false);
  });
});

describe('stan terminu otwartego', () => {
  it('termin po dacie upływu jest przekroczony', () => {
    assert.equal(stanTerminu('2026-09-18', '2026-09-21'), 'przekroczony');
  });

  it('termin w granicach progu ostrzegania jest zbliżający się', () => {
    assert.equal(stanTerminu('2026-09-25', '2026-09-21'), 'zblizajacy_sie');
  });

  it('termin dzisiejszy jest zbliżający się, nie przekroczony', () => {
    assert.equal(stanTerminu('2026-09-21', '2026-09-21'), 'zblizajacy_sie');
  });

  it('termin poza progiem jest odległy', () => {
    assert.equal(stanTerminu('2026-10-30', '2026-09-21'), 'odlegly');
  });

  it('próg ostrzegania jest konfigurowalny', () => {
    assert.equal(stanTerminu('2026-10-10', '2026-09-21', 30), 'zblizajacy_sie');
  });
});
