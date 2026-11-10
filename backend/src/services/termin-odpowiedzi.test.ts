import { strict as assert } from 'node:assert';
import { it } from 'node:test';
import { odczytajTerminyOdpowiedzi as odczytaj, ustawieniaTerminu, wyliczTerminOdpowiedzi as wylicz } from './termin-odpowiedzi.js';
it('odczytuje stałą datę ISO z wezwania do zapłaty', () => {
  const p = odczytaj('Wymienioną kwotę prosimy przekazać na rachunek wierzyciela do dnia 2026-11-05.');
  assert.equal(p.length, 1); assert.equal(p[0]!.ustawienia.tryb, 'data');
  assert.equal(p[0]!.ustawienia.tryb === 'data' && p[0]!.ustawienia.dataUplywu, '2026-11-05');
});
it('odczytuje datę w polskim zapisie i nie bierze daty wystawienia pisma', () => {
  const p = odczytaj('Gorzów, 01.11.2026. Wzywamy do zapłaty do dnia 5.11.2026 r.');
  assert.equal(p.length, 1); assert.equal(p[0]!.ustawienia.tryb === 'data' && p[0]!.ustawienia.dataUplywu, '2026-11-05');
});
it('rozpoznaje liczbę dni, zapis słowny i podstawę doręczenia', () => {
  for (const ile of ['7', 'siedmiu', '7 (siedmiu)']) {
    const p = odczytaj(`Wzywamy do złożenia wyjaśnień w terminie ${ile} dni od dnia doręczenia wezwania.`)[0]!;
    assert.equal(p.podstawa, 'wplyw'); assert.equal(p.ustawienia.tryb === 'dni' && p.ustawienia.liczbaDni, 7);
  }
});
it('rozpoznaje dni robocze, a brak podstawy wymaga innej daty', () => {
  const p = odczytaj('Prosimy o odpowiedź w ciągu 3 dni roboczych od otrzymania pisma.')[0]!;
  assert.equal(p.ustawienia.tryb === 'dni' && p.ustawienia.sposobLiczenia, 'dni_robocze');
  assert.equal(odczytaj('Prosimy o odpowiedź w terminie 14 dni.')[0]!.podstawa, 'inna');
});
it('zwraca różne terminy i pomija pouczenie o odwołaniu', () => {
  assert.equal(odczytaj('Wzywamy do zapłaty do 10.11.2026. Prosimy o odpowiedź do 12.11.2026.').length, 2);
  assert.equal(odczytaj('Odwołanie można złożyć w terminie 14 dni od doręczenia.').length, 0);
  assert.equal(odczytaj('Wzywamy do odpowiedzi do dnia 31.02.2026.').length, 0);
});
it('zachowuje datę sprzed wpływu z ostrzeżeniem zamiast zmieniać ją na późniejszą', () => {
  const t = wylicz(ustawieniaTerminu.parse({ tryb: 'data', dataUplywu: '2026-11-05' }), '2026-11-06', new Set());
  assert.equal(t.dataUplywu, '2026-11-05'); assert.ok(t.ostrzezenie);
});
it('liczy dni od wpływu lub innej daty i przesuwa wolny dzień tylko po wybraniu opcji', () => {
  const baza = { tryb: 'dni', liczbaDni: 1 };
  assert.equal(wylicz(ustawieniaTerminu.parse(baza), '2026-11-06', new Set()).dataUplywu, '2026-11-07');
  assert.equal(wylicz(ustawieniaTerminu.parse({ ...baza, przesuwajDniWolne: true }), '2026-11-06', new Set()).dataUplywu, '2026-11-09');
  assert.equal(wylicz(ustawieniaTerminu.parse({ ...baza, dataPoczatkowa: '2026-11-10' }), '2026-11-06', new Set()).dataUplywu, '2026-11-11');
  assert.equal(wylicz(ustawieniaTerminu.parse({ ...baza, sposobLiczenia: 'dni_robocze' }), '2026-11-06', new Set()).dataUplywu, '2026-11-09');
});
