import { strict as assert } from 'node:assert';
import { it } from 'node:test';
import { planPrzypisania, przypiszSkan, type StanPrzypisania } from './przypisanie-skanu.js';
const sha = 'a'.repeat(64);
const plan = planPrzypisania.parse({ skanId: 'skan-test', sha256: sha, nowaSprawa: { tytul: 'Sprawa testowa', grupaId: 9 }, nowePismo: { rodzaj: 'Wezwanie', korespondent: 'Nadawca testowy' } });
function przygotuj() {
  const zdarzenia: { metoda: string; url: string; dane: any }[] = [];
  const skan = { id: 'skan-test', nazwa: 'test.pdf', gotowy: true, zaDuzy: false, dataWplywu: '2026-11-06', terminOdpowiedzi: null };
  const pisma: any[] = []; let awaria = false;
  const api = async (metoda: string, url: string, dane?: any): Promise<any> => {
    zdarzenia.push({ metoda, url, dane });
    if (url === '/skany') return { skany: [skan] };
    if (url.endsWith('/rozpoznaj')) return { sha256: sha, propozycjeTerminow: [] };
    if (url === '/grupy') return { grupy: [{ id: 9 }] };
    if (url === '/sprawy' && metoda === 'POST') return { sprawa: { id: 11 } };
    if (url === '/sprawy/11' && metoda === 'GET') return { sprawa: { id: 11 }, pisma };
    if (url === '/sprawy/11/pisma') { const p = { id: 21, kierunek: 'przychodzace', ...dane }; pisma.push(p); return { pismo: p }; }
    if (url.endsWith('/import')) { if (awaria) throw new Error('Przerwane połączenie'); return { dokument: { id: 31 }, terminId: null, archiwizowano: true, ostrzezenie: null }; }
    throw new Error(`Nieoczekiwane żądanie ${metoda} ${url}`);
  };
  return { api, zdarzenia, skan, pisma, awaria: (stan: boolean) => { awaria = stan; } };
}
it('podgląd nie tworzy sprawy, pisma ani dokumentu', async () => {
  const f = przygotuj(); const wynik = await przypiszSkan(f.api, plan, false);
  assert.equal(wynik.tryb, 'podglad');
  assert.equal(f.zdarzenia.filter(z => z.metoda !== 'GET' && !z.url.endsWith('/rozpoznaj')).length, 0);
});
it('zapis zachowuje datę wpływu i przekazuje SHA-256 bez zatwierdzania terminu OCR', async () => {
  const f = przygotuj(); const etapy: StanPrzypisania[] = [];
  const wynik = await przypiszSkan(f.api, plan, true, {}, async s => { etapy.push(structuredClone(s)); });
  assert.equal(wynik.wynik?.dokumentId, 31); assert.equal(etapy.length, 3);
  assert.equal(f.pisma[0].dataDoreczenia, '2026-11-06');
  assert.equal(f.zdarzenia.find(z => z.url.endsWith('/import'))!.dane.sha256, sha);
  assert.equal(f.zdarzenia.some(z => z.url.endsWith('/termin-odpowiedzi')), false);
});
it('wznawia po błędzie importu bez ponownego tworzenia zapisanej sprawy i pisma', async () => {
  const f = przygotuj(); let dziennik: StanPrzypisania = {};
  const zapisz = async (s: StanPrzypisania) => { dziennik = structuredClone(s); };
  f.awaria(true); await assert.rejects(przypiszSkan(f.api, plan, true, {}, zapisz), /Przerwane/);
  assert.equal(dziennik.sprawaId, 11); assert.equal(dziennik.pismoId, 21);
  f.awaria(false); const wynik = await przypiszSkan(f.api, plan, true, dziennik, zapisz);
  assert.equal(wynik.wynik?.dokumentId, 31);
  assert.equal(f.zdarzenia.filter(z => z.url === '/sprawy' && z.metoda === 'POST').length, 1); assert.equal(f.pisma.length, 1);
  const n = f.zdarzenia.length;
  assert.equal((await przypiszSkan(f.api, plan, true, dziennik, zapisz)).wykonanoWczesniej, true); assert.equal(f.zdarzenia.length, n);
});
it('odmawia zapisu bez wpływu i przy podmienionym pliku przed utworzeniem danych', async () => {
  const f = przygotuj(); f.skan.dataWplywu = '';
  await assert.rejects(przypiszSkan(f.api, plan, true), /datę wpływu/);
  await assert.rejects(przypiszSkan(przygotuj().api, { ...plan, sha256: 'b'.repeat(64) }, true), /Plik zmienił/);
  assert.equal(f.zdarzenia.some(z => z.url === '/sprawy' && z.metoda === 'POST'), false);
});
it('odmawia dołączenia do pisma spoza wskazanej sprawy', async () => {
  const f = przygotuj();
  const istniejacy = planPrzypisania.parse({ skanId: plan.skanId, sha256: sha, sprawaId: 11, pismoId: 999 });
  await assert.rejects(przypiszSkan(f.api, istniejacy, true), /nie należy/);
});
it('plan wymaga jednoznacznego wskazania sprawy i pisma', () => {
  assert.equal(planPrzypisania.safeParse({ ...plan, sprawaId: 11 }).success, false);
  assert.equal(planPrzypisania.safeParse({ skanId: 'a', sha256: sha, nowaSprawa: { tytul: 'Nowa' }, pismoId: 1 }).success, false);
});
