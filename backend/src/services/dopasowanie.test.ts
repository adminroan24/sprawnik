import { strict as assert } from 'node:assert';
import { it } from 'node:test';
import { dopasujSprawy, type SprawaDoDopasowania } from './dopasowanie.js';
const sprawa: SprawaDoDopasowania = { id: 1, tytul: 'Przykład', znakWlasny: 'ABC.123.2026', organ: 'Urząd Miasta', znakiPism: ['DEF/456/2026'] };
it('dopasowuje znaki sprawy mimo spacji OCR i różnicy separatorów', () => {
  assert.equal(dopasujSprawy('Znak: abc / 123 / 2026', [sprawa])[0]?.pewnosc, 'wysoka');
});
it('rozpoznaje odwołanie do wcześniejszego pisma', () => {
  assert.match(dopasujSprawy('W odpowiedzi na DEF/456/2026', [sprawa])[0]!.powody[0]!, /wcześniejszego/);
});
it('nie dopasowuje fragmentu większego identyfikatora ani zbyt krótkich oznaczeń', () => {
  assert.equal(dopasujSprawy('XABC.123.2026Y', [sprawa]).length, 0);
  assert.equal(dopasujSprawy('12345', [{ ...sprawa, znakWlasny: '12345' }]).length, 0);
});
it('zachowuje oba dopasowania przy wspólnym znaku', () => {
  assert.equal(dopasujSprawy('ABC.123.2026', [sprawa, { ...sprawa, id: 2 }]).length, 2);
});
it('sama nazwa instytucji jest słabą wskazówką, a zgodny znak ma pierwszeństwo', () => {
  assert.equal(dopasujSprawy('Urząd Miasta', [sprawa])[0]?.pewnosc, 'niska');
  assert.deepEqual(dopasujSprawy('Urząd Miasta DEF/456/2026', [sprawa, { ...sprawa, id: 2, znakiPism: [] }]).map(s => s.sprawaId), [1]);
});
