import { strict as assert } from 'node:assert';
import { it } from 'node:test';
import { setTimeout as odczekaj } from 'node:timers/promises';
import { uruchomPetle } from './obsluga-skanow.js';

it('nie uruchamia kolejnego przebiegu, gdy poprzedni nadal pracuje, i czeka przy zatrzymaniu', async () => {
  let zwolnij!: () => void;
  const bramka = new Promise<void>(r => { zwolnij = r; });
  let wywolania = 0;
  const stop = uruchomPetle(async () => { wywolania++; await bramka; }, 1);
  await odczekaj(20); assert.equal(wywolania, 1);
  let zakonczono = false; const zamkniecie = stop().then(() => { zakonczono = true; });
  await odczekaj(5); assert.equal(zakonczono, false);
  zwolnij(); await zamkniecie; await odczekaj(10); assert.equal(wywolania, 1);
});
it('po błędzie ponawia kolejkę, a zatrzymanie usuwa następne wywołania', async () => {
  let n = 0, bledy = 0, gotowe!: () => void;
  const drugi = new Promise<void>(r => { gotowe = r; });
  const stop = uruchomPetle(async () => { n++; if (n === 1) throw new Error('awaria'); gotowe(); }, 1, () => { bledy++; });
  await drugi; await stop(); const koniec = n;
  await odczekaj(10); assert.equal(n, koniec); assert.equal(bledy, 1);
});
