/**
 * Testy tras API — sprawdzają aplikację od strony żądania HTTP, wraz z bazą.
 *
 * Uzupełniają testy silnika terminów, które działają bez serwera: tutaj
 * przedmiotem sprawdzenia jest to, czy warstwy poskładane razem zachowują się
 * zgodnie z przypadkami użycia — łącznie z powstawaniem terminu przy
 * rejestracji pisma oraz z rozdzieleniem dostępu między użytkownikami.
 */

import { strict as assert } from 'node:assert';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import * as uzytkownicy from '../db/uzytkownicy.js';
import { zahaszujHaslo } from '../services/uwierzytelnianie.js';
import { createHash } from 'node:crypto';
import { writeFile, unlink, rm, readFile, mkdtemp, mkdir, utimes, symlink, readdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { env } from '../config/env.js';
import * as dokumentyDb from '../db/dokumenty.js';
import { pool } from '../db/pool.js';
import {
  klient,
  odtworzBaze,
  uruchomSerwer,
  wyczyscDane,
  zamknijPule,
  type Serwer,
} from './baza.js';

let serwer: Serwer;

const HASLO = 'haslo-testowe';

async function zaloguj(email: string, rola: 'uzytkownik' | 'administrator' = 'uzytkownik') {
  await uzytkownicy.dodaj({
    email,
    hasloHash: await zahaszujHaslo(HASLO),
    imieNazwisko: 'Osoba Testowa',
    rola,
  });
  const { tresc } = await klient(serwer.adres).wyslij('/api/logowanie', { email, haslo: HASLO });
  return klient(serwer.adres, tresc.token as string);
}

before(async () => {
  await odtworzBaze();
  serwer = await uruchomSerwer();
});

after(async () => {
  await serwer.zatrzymaj();
  await zamknijPule();
  if (env.uploadDir.startsWith('/tmp/sprawnik-api-test-')) {
    await rm(env.uploadDir, { recursive: true, force: true });
  }
});

beforeEach(async () => {
  await wyczyscDane();
});

describe('uwierzytelnianie', () => {
  it('zwraca token przy poprawnych danych', async () => {
    await uzytkownicy.dodaj({
      email: 'osoba@example.com',
      hasloHash: await zahaszujHaslo(HASLO),
      imieNazwisko: 'Osoba Testowa',
      rola: 'uzytkownik',
    });

    const { kod, tresc } = await klient(serwer.adres).wyslij('/api/logowanie', {
      email: 'osoba@example.com',
      haslo: HASLO,
    });

    assert.equal(kod, 200);
    assert.ok(tresc.token);
    assert.equal(tresc.uzytkownik.email, 'osoba@example.com');
  });

  it('nie ujawnia, czy konto istnieje — oba przypadki dają ten sam komunikat', async () => {
    await uzytkownicy.dodaj({
      email: 'osoba@example.com',
      hasloHash: await zahaszujHaslo(HASLO),
      imieNazwisko: 'Osoba Testowa',
      rola: 'uzytkownik',
    });

    const nieistniejace = await klient(serwer.adres).wyslij('/api/logowanie', {
      email: 'nikt@example.com',
      haslo: HASLO,
    });
    const bledneHaslo = await klient(serwer.adres).wyslij('/api/logowanie', {
      email: 'osoba@example.com',
      haslo: 'inne-haslo',
    });

    assert.equal(nieistniejace.kod, 401);
    assert.equal(bledneHaslo.kod, 401);
    assert.equal(nieistniejace.tresc.error, bledneHaslo.tresc.error);
  });

  it('odmawia dostępu do spraw bez tokenu', async () => {
    const { kod } = await klient(serwer.adres).pobierz('/api/sprawy');
    assert.equal(kod, 401);
  });
});

describe('rejestracja sprawy i pisma', () => {
  it('wyznacza termin przy piśmie z datą doręczenia (UC3 zawiera UC7)', async () => {
    const api = await zaloguj('sprawa@example.com');
    const { tresc: nowa } = await api.wyslij('/api/sprawy', { tytul: 'Sprawa testowa' });

    const { tresc: reguly } = await api.pobierz('/api/reguly');
    const regula = reguly.reguly.find((r: { nazwa: string }) => r.nazwa === 'Odwołanie od decyzji');

    const { kod, tresc } = await api.wyslij(`/api/sprawy/${nowa.sprawa.id}/pisma`, {
      kierunek: 'przychodzace',
      rodzaj: 'Decyzja',
      korespondent: 'Urząd',
      dataNadania: '2026-09-01',
      dataDoreczenia: '2026-09-04',
      regulaId: regula.id,
    });

    assert.equal(kod, 201);
    // 14 dni kalendarzowych od piątku 4 września 2026 upływa w piątek 18 września.
    assert.equal(tresc.termin.dataUplywu, '2026-09-18');
    assert.equal(tresc.termin.dataPoczatkowa, '2026-09-04');
    assert.equal(tresc.termin.sposobWyznaczenia, 'automatyczny');
    assert.equal(tresc.termin.regulaId, regula.id);
  });

  it('przesuwa termin wypadający na dzień wolny', async () => {
    const api = await zaloguj('przesuniecie@example.com');
    const { tresc: nowa } = await api.wyslij('/api/sprawy', { tytul: 'Sprawa testowa' });
    const { tresc: reguly } = await api.pobierz('/api/reguly');
    const regula = reguly.reguly.find(
      (r: { nazwa: string }) => r.nazwa === 'Uzupełnienie braków formalnych',
    );

    const { tresc } = await api.wyslij(`/api/sprawy/${nowa.sprawa.id}/pisma`, {
      kierunek: 'przychodzace',
      rodzaj: 'Wezwanie',
      korespondent: 'Urząd',
      dataDoreczenia: '2026-09-19',
      regulaId: regula.id,
    });

    // 7 dni od soboty 19 września 2026 wypada w sobotę 26 września — termin
    // przechodzi na poniedziałek 28 września.
    assert.equal(tresc.termin.dataUplywu, '2026-09-28');
  });

  it('zapisuje pismo bez terminu, gdy doręczenie nie nastąpiło', async () => {
    const api = await zaloguj('oczekujace@example.com');
    const { tresc: nowa } = await api.wyslij('/api/sprawy', { tytul: 'Sprawa testowa' });
    const { tresc: reguly } = await api.pobierz('/api/reguly');
    const regula = reguly.reguly.find((r: { nazwa: string }) => r.nazwa === 'Odwołanie od decyzji');

    const { kod, tresc } = await api.wyslij(`/api/sprawy/${nowa.sprawa.id}/pisma`, {
      kierunek: 'przychodzace',
      rodzaj: 'Decyzja',
      korespondent: 'Urząd',
      dataNadania: '2026-09-18',
      regulaId: regula.id,
    });

    assert.equal(kod, 201);
    assert.equal(tresc.termin, null);
    assert.match(tresc.powodBrakuTerminu, /potwierdzenie doręczenia/);
  });

  it('wyznacza termin dopiero po uzupełnieniu daty doręczenia', async () => {
    const api = await zaloguj('uzupelnienie@example.com');
    const { tresc: nowa } = await api.wyslij('/api/sprawy', { tytul: 'Sprawa testowa' });
    const { tresc: reguly } = await api.pobierz('/api/reguly');
    const regula = reguly.reguly.find((r: { nazwa: string }) => r.nazwa === 'Odwołanie od decyzji');

    const { tresc: zarejestrowane } = await api.wyslij(`/api/sprawy/${nowa.sprawa.id}/pisma`, {
      kierunek: 'przychodzace',
      rodzaj: 'Decyzja',
      korespondent: 'Urząd',
      dataNadania: '2026-09-01',
      regulaId: regula.id,
    });

    const { kod, tresc } = await api.zmien(`/api/pisma/${zarejestrowane.pismo.id}/doreczenie`, {
      dataDoreczenia: '2026-09-04',
      regulaId: regula.id,
    });

    assert.equal(kod, 200);
    assert.equal(tresc.termin.dataUplywu, '2026-09-18');
  });

  it('odrzuca datę doręczenia wcześniejszą niż data nadania', async () => {
    const api = await zaloguj('daty@example.com');
    const { tresc: nowa } = await api.wyslij('/api/sprawy', { tytul: 'Sprawa testowa' });

    const { kod } = await api.wyslij(`/api/sprawy/${nowa.sprawa.id}/pisma`, {
      kierunek: 'przychodzace',
      rodzaj: 'Decyzja',
      korespondent: 'Urząd',
      dataNadania: '2026-09-10',
      dataDoreczenia: '2026-09-01',
      regulaId: null,
    });

    assert.equal(kod, 400);
  });

  it('wskazuje pole, którego brakuje w żądaniu', async () => {
    const api = await zaloguj('walidacja@example.com');
    const { tresc: nowa } = await api.wyslij('/api/sprawy', { tytul: 'Sprawa testowa' });

    const { kod, tresc } = await api.wyslij(`/api/sprawy/${nowa.sprawa.id}/pisma`, {
      kierunek: 'przychodzace',
      korespondent: 'Urząd',
    });

    assert.equal(kod, 400);
    assert.ok(tresc.szczegoly.some((problem: { pole: string }) => problem.pole === 'rodzaj'));
  });
});

describe('rozdzielenie dostępu', () => {
  it('sprawa innego użytkownika jest niedostępna i zgłaszana jako nieistniejąca', async () => {
    const pierwszy = await zaloguj('pierwszy@example.com');
    const drugi = await zaloguj('drugi@example.com');

    const { tresc: nowa } = await pierwszy.wyslij('/api/sprawy', { tytul: 'Sprawa pierwszego' });

    const odczyt = await drugi.pobierz(`/api/sprawy/${nowa.sprawa.id}`);
    assert.equal(odczyt.kod, 404);

    const lista = await drugi.pobierz('/api/sprawy');
    assert.equal(lista.tresc.sprawy.length, 0);
  });

  it('definiowanie reguły terminu wymaga uprawnień administratora', async () => {
    const zwykly = await zaloguj('zwykly@example.com');
    const administrator = await zaloguj('administrator@example.com', 'administrator');

    const nowaRegula = {
      nazwa: 'Reguła testowa',
      liczbaDni: 5,
      sposobLiczenia: 'dni_robocze',
      zdarzeniePoczatkowe: 'doreczenie',
      przesuwajDniWolne: true,
    };

    assert.equal((await zwykly.wyslij('/api/reguly', nowaRegula)).kod, 403);
    assert.equal((await administrator.wyslij('/api/reguly', nowaRegula)).kod, 201);
  });
});

describe('przegląd terminów', () => {
  it('kwalifikuje terminy do stanów i podaje dzień wyliczenia', async () => {
    const api = await zaloguj('przeglad@example.com');
    const { tresc: nowa } = await api.wyslij('/api/sprawy', { tytul: 'Sprawa testowa' });

    const dzisiaj = new Date();
    const zaTrzyDni = new Date(dzisiaj.getTime() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    await api.wyslij(`/api/sprawy/${nowa.sprawa.id}/terminy`, {
      czynnosc: 'Termin bliski',
      dataPoczatkowa: dzisiaj.toISOString().slice(0, 10),
      dataUplywu: zaTrzyDni,
    });

    const { tresc } = await api.pobierz('/api/terminy?status=otwarty');

    assert.equal(tresc.terminy.length, 1);
    assert.equal(tresc.terminy[0].stan, 'zblizajacy_sie');
    assert.equal(tresc.terminy[0].sposobWyznaczenia, 'reczny');
    assert.equal(tresc.podsumowanie.zblizajacy_sie, 1);
    assert.equal(tresc.dzien, dzisiaj.toISOString().slice(0, 10));
  });

  it('termin wykonany przestaje podlegać ostrzeganiu', async () => {
    const api = await zaloguj('wykonany@example.com');
    const { tresc: nowa } = await api.wyslij('/api/sprawy', { tytul: 'Sprawa testowa' });
    const { tresc: dodany } = await api.wyslij(`/api/sprawy/${nowa.sprawa.id}/terminy`, {
      czynnosc: 'Termin przeterminowany',
      dataPoczatkowa: '2026-01-01',
      dataUplywu: '2026-01-15',
    });

    await api.zmien(`/api/terminy/${dodany.termin.id}`, { status: 'wykonany' });

    const { tresc } = await api.pobierz('/api/terminy?status=wszystkie');
    assert.equal(tresc.terminy[0].status, 'wykonany');
    assert.equal(tresc.terminy[0].stan, null);
    assert.ok(tresc.terminy[0].dataWykonania);
  });
});

describe('dokumenty', () => {
  async function przygotuj() {
    const api = await zaloguj('dokumenty@example.com');
    const { tresc } = await api.wyslij('/api/sprawy', { tytul: 'Sprawa z dokumentami' });
    const sprawaId = tresc.sprawa.id as number;
    const wynik = await api.wyslij(`/api/sprawy/${sprawaId}/pisma`, {
      kierunek: 'przychodzace', rodzaj: 'Decyzja', korespondent: 'Urząd demonstracyjny',
    });
    return { api, sprawaId, pismoId: wynik.tresc.pismo.id as number };
  }

  it('zapisuje plik, jego sumę kontrolną i chronologię; pobiera identyczną treść', async () => {
    const { api, sprawaId, pismoId } = await przygotuj();
    const plik = Buffer.from('Przykładowa treść dokumentu\n');
    const { kod, tresc } = await api.przeslijPlik(pismoId, 'Zaświadczenie ćwiczeniowe.txt', plik);
    assert.equal(kod, 201);
    assert.equal(tresc.dokument.rozmiarBajtow, plik.length);
    assert.equal(tresc.dokument.sumaKontrolna, createHash('sha256').update(plik).digest('hex'));
    assert.equal(tresc.dokument.nazwaWMagazynie, undefined);
    const pobrany = await api.pobierzPlik(tresc.dokument.id);
    assert.equal(pobrany.kod, 200);
    assert.deepEqual(pobrany.plik, plik);
    assert.equal(pobrany.naglowki.get('content-type'), 'application/octet-stream');
    assert.match(pobrany.naglowki.get('content-disposition')!, /^attachment;/);
    assert.equal(pobrany.naglowki.get('x-content-type-options'), 'nosniff');
    const sprawa = await api.pobierz(`/api/sprawy/${sprawaId}`);
    assert.ok(sprawa.tresc.chronologia.some((z: { rodzaj: string; opis: string }) =>
      z.rodzaj === 'dokument' && z.opis.includes('Zaświadczenie')));
  });

  it('wyszukuje dokumenty po nazwie i filtruje według pisma', async () => {
    const { api, sprawaId, pismoId } = await przygotuj();
    const drugie = await api.wyslij(`/api/sprawy/${sprawaId}/pisma`, {
      kierunek: 'wychodzace', rodzaj: 'Wniosek', korespondent: 'Urząd demonstracyjny',
    });
    await api.przeslijPlik(pismoId, 'decyzja.pdf', Buffer.from('przyklad A'));
    await api.przeslijPlik(drugie.tresc.pismo.id, 'wniosek.pdf', Buffer.from('przyklad B'));
    const szukaj = await api.pobierz(`/api/sprawy/${sprawaId}/dokumenty?szukaj=DECYZJA`);
    assert.equal(szukaj.tresc.dokumenty.length, 1);
    assert.equal(szukaj.tresc.dokumenty[0].nazwaOryginalna, 'decyzja.pdf');
    const filtr = await api.pobierz(`/api/sprawy/${sprawaId}/dokumenty?pismoId=${drugie.tresc.pismo.id}`);
    assert.deepEqual(filtr.tresc.dokumenty.map((d: { nazwaOryginalna: string }) => d.nazwaOryginalna), ['wniosek.pdf']);
    const razem = await api.pobierz(`/api/sprawy/${sprawaId}/dokumenty?szukaj=decyzja&pismoId=${drugie.tresc.pismo.id}`);
    assert.equal(razem.tresc.dokumenty.length, 0);
  });

  it('odmawia dostępu do pliku, wykazu i przesyłania do cudzego pisma', async () => {
    const { api, sprawaId, pismoId } = await przygotuj();
    const { tresc } = await api.przeslijPlik(pismoId, 'prywatny.txt', Buffer.from('dane demonstracyjne'));
    const obcy = await zaloguj('obcy@example.com', 'administrator');
    assert.equal((await obcy.pobierzPlik(tresc.dokument.id)).kod, 404);
    assert.equal((await obcy.pobierz(`/api/sprawy/${sprawaId}/dokumenty`)).kod, 404);
    assert.equal((await obcy.przeslijPlik(pismoId, 'obcy.txt', Buffer.from('test'))).kod, 404);
    assert.equal((await klient(serwer.adres).pobierzPlik(tresc.dokument.id)).kod, 401);
    assert.equal((await klient(serwer.adres).przeslijPlik(pismoId, 'brak-konta.txt', Buffer.from('test'))).kod, 401);
  });

  it('odrzuca pusty plik, zbyt duży plik i nazwę zawierającą ścieżkę', async () => {
    const { api, sprawaId, pismoId } = await przygotuj();
    assert.equal((await api.przeslijPlik(pismoId, 'pusty.txt', Buffer.alloc(0))).kod, 400);
    assert.equal((await api.przeslijPlik(pismoId, '../poza-magazynem', Buffer.from('test'))).kod, 400);
    assert.equal((await api.przeslijPlik(pismoId, 'duzy.bin', Buffer.alloc(10 * 1024 * 1024 + 1))).kod, 413);
    const lista = await api.pobierz(`/api/sprawy/${sprawaId}/dokumenty`);
    assert.equal(lista.tresc.dokumenty.length, 0);
  });

  it('dwa pliki o tej samej nazwie nie nadpisują się', async () => {
    const { api, pismoId } = await przygotuj();
    const a = await api.przeslijPlik(pismoId, 'decyzja.pdf', Buffer.from('pierwszy'));
    const b = await api.przeslijPlik(pismoId, 'decyzja.pdf', Buffer.from('drugi'));
    assert.notEqual(a.tresc.dokument.id, b.tresc.dokument.id);
    assert.equal((await api.pobierzPlik(a.tresc.dokument.id)).plik.toString(), 'pierwszy');
    assert.equal((await api.pobierzPlik(b.tresc.dokument.id)).plik.toString(), 'drugi');
  });

  it('wykrywa zmianę oraz brak pliku w magazynie', async () => {
    const { api, pismoId } = await przygotuj();
    const { tresc } = await api.przeslijPlik(pismoId, 'kontrola.txt', Buffer.from('oryginal'));
    const dokument = await dokumentyDb.znajdzDlaUzytkownika(tresc.dokument.id, 1);
    assert.ok(dokument);
    const miejsce = path.join(env.uploadDir, dokument.nazwaWMagazynie);
    await writeFile(miejsce, 'zmieniony');
    assert.equal((await api.pobierzPlik(dokument.id)).kod, 409);
    await unlink(miejsce);
    assert.equal((await api.pobierzPlik(dokument.id)).kod, 410);
  });
});

describe('obsługa spraw i konfiguracja', () => {
  it('zmienia status sprawy i uwzględnia go w filtrze rejestru', async () => {
    const api = await zaloguj('status@example.com');
    const { tresc } = await api.wyslij('/api/sprawy', { tytul: 'Sprawa zamykana' });
    assert.equal((await api.zmien(`/api/sprawy/${tresc.sprawa.id}`, { status: 'zakonczona' })).kod, 200);
    assert.equal((await api.pobierz('/api/sprawy?status=w_toku')).tresc.sprawy.length, 0);
    assert.equal((await api.pobierz('/api/sprawy?status=zakonczona')).tresc.sprawy.length, 1);
  });

  it('parametr wszystkie=false wyklucza nieaktywne reguły', async () => {
    const api = await zaloguj('reguly@example.com');
    await pool.query('UPDATE regula_terminu SET aktywna = false WHERE id = 1');
    try {
      const aktywne = await api.pobierz('/api/reguly?wszystkie=false');
      const wszystkie = await api.pobierz('/api/reguly?wszystkie=true');
      assert.equal(aktywne.tresc.reguly.some((r: { id: number }) => r.id === 1), false);
      assert.equal(wszystkie.tresc.reguly.some((r: { id: number }) => r.id === 1), true);
    } finally { await pool.query('UPDATE regula_terminu SET aktywna = true WHERE id = 1'); }
  });
});

describe('obieg korespondencji', () => {
  it('łączy wpływ, przygotowanie odpowiedzi, nadanie, dowody i późniejszą odpowiedź', async () => {
    const api = await zaloguj('obieg@example.com');
    const { tresc } = await api.wyslij('/api/sprawy', { tytul: 'Pełny obieg pisma' });
    const sciezka = `/api/sprawy/${tresc.sprawa.id}`;
    const wplyw = await api.wyslij(`${sciezka}/pisma`, {
      kierunek: 'przychodzace', rodzaj: 'Wezwanie', korespondent: 'Urząd', dataDoreczenia: '2026-11-02',
    });
    const odpowiedz = await api.wyslij(`${sciezka}/pisma`, {
      kierunek: 'wychodzace', rodzaj: 'Wyjaśnienia', korespondent: 'Urząd',
      odpowiedzNaPismoId: wplyw.tresc.pismo.id, kanal: 'edoreczenia',
    });
    assert.equal(odpowiedz.kod, 201);
    assert.equal(odpowiedz.tresc.pismo.odpowiedzNaPismoId, wplyw.tresc.pismo.id);
    assert.equal(odpowiedz.tresc.pismo.dataNadania, null);
    const przed = await api.pobierz(sciezka);
    assert.ok(przed.tresc.chronologia.some((z: { opis: string }) => z.opis.startsWith('Przygotowano:')));
    const id = odpowiedz.tresc.pismo.id;
    const nadanie = await api.zmien(`/api/pisma/${id}/nadanie`, {
      dataNadania: '2026-11-03', kanal: 'edoreczenia', numerNadania: 'DEMO-NADANIE-123',
    });
    assert.equal(nadanie.kod, 200);
    assert.equal(nadanie.tresc.pismo.numerNadania, 'DEMO-NADANIE-123');
    const dowod = await api.przeslijPlik(id, 'dowod.xml', Buffer.from('<dowod>demo</dowod>'), 'dowod_nadania');
    assert.equal(dowod.kod, 201);
    assert.equal(dowod.tresc.dokument.rola, 'dowod_nadania');
    const doreczenie = await api.zmien(`/api/pisma/${id}/doreczenie`, { dataDoreczenia: '2026-11-04' });
    assert.equal(doreczenie.kod, 200);
    await api.przeslijPlik(id, 'odbior.xml', Buffer.from('<odbior>demo</odbior>'), 'potwierdzenie_odbioru');
    const kolejna = await api.wyslij(`${sciezka}/pisma`, {
      kierunek: 'przychodzace', rodzaj: 'Odpowiedź urzędu', korespondent: 'Urząd',
      dataDoreczenia: '2026-11-06', odpowiedzNaPismoId: id,
    });
    assert.equal(kolejna.kod, 201);
    const wynik = await api.pobierz(sciezka);
    const wydarzenia = wynik.tresc.chronologia as { data: string; opis: string }[];
    assert.ok(wydarzenia.some((z) => z.data === '2026-11-03' && z.opis.startsWith('Wysłano:')));
    assert.ok(wydarzenia.some((z) => z.data === '2026-11-04' && z.opis.startsWith('Potwierdzono doręczenie:')));
    assert.ok(wydarzenia.some((z) => z.opis.startsWith('Dowód nadania:')));
    const dowody = await api.pobierz(`${sciezka}/dokumenty?rola=dowod_nadania`);
    assert.equal(dowody.tresc.dokumenty.length, 1);
    assert.equal((await api.zmien(`/api/pisma/${id}/nadanie`, { dataNadania: '2026-11-05' })).kod, 400);
  });

  it('nie pozwala wiązać odpowiedzi z inną sprawą, także innego właściciela', async () => {
    const a = await zaloguj('odpowiedz-a@example.com');
    const b = await zaloguj('odpowiedz-b@example.com');
    const pierwsza = await a.wyslij('/api/sprawy', { tytul: 'Pierwsza' });
    const druga = await b.wyslij('/api/sprawy', { tytul: 'Druga' });
    const pismo = await b.wyslij(`/api/sprawy/${druga.tresc.sprawa.id}/pisma`, {
      kierunek: 'przychodzace', rodzaj: 'Prywatne pismo', korespondent: 'Instytucja',
    });
    const wynik = await a.wyslij(`/api/sprawy/${pierwsza.tresc.sprawa.id}/pisma`, {
      kierunek: 'wychodzace', rodzaj: 'Odpowiedź', korespondent: 'Instytucja', odpowiedzNaPismoId: pismo.tresc.pismo.id,
    });
    assert.equal(wynik.kod, 400);
    assert.equal((await a.pobierz(`/api/sprawy/${pierwsza.tresc.sprawa.id}`)).tresc.pisma.length, 0);
    assert.equal((await a.zmien(`/api/pisma/${pismo.tresc.pismo.id}/nadanie`, { dataNadania: '2026-11-03' })).kod, 404);
  });

  it('zapisuje nadanie i wynikający z niego termin atomowo', async () => {
    const api = await zaloguj('nadanie@example.com', 'administrator');
    const sprawa = await api.wyslij('/api/sprawy', { tytul: 'Nadanie z terminem' });
    const pismo = await api.wyslij(`/api/sprawy/${sprawa.tresc.sprawa.id}/pisma`, {
      kierunek: 'wychodzace', rodzaj: 'Wniosek', korespondent: 'Instytucja',
    });
    const regula = await api.wyslij('/api/reguly', { nazwa: 'Test od nadania', liczbaDni: 3,
      sposobLiczenia: 'dni_kalendarzowe', zdarzeniePoczatkowe: 'nadanie', przesuwajDniWolne: false });
    const wynik = await api.zmien(`/api/pisma/${pismo.tresc.pismo.id}/nadanie`, {
      dataNadania: '2026-11-03', regulaId: regula.tresc.regula.id,
    });
    assert.equal(wynik.kod, 200);
    assert.equal(wynik.tresc.termin.dataUplywu, '2026-11-06');
    assert.equal(wynik.tresc.termin.dataPoczatkowa, '2026-11-03');
  });
});

const ocrDostepny = spawnSync('tesseract', ['--list-langs'], { encoding: 'utf8' });
const maOcr = ocrDostepny.status === 0 && /\bpol\b/.test(ocrDostepny.stdout) && /\beng\b/.test(ocrDostepny.stdout);
const maPdf = spawnSync('pdftoppm', ['-v']).status === 0 && spawnSync('pdfinfo', ['-v']).status === 0;

describe('OCR dokumentów', () => {
  async function przygotuj() {
    const api = await zaloguj('ocr@example.com');
    const sprawa = await api.wyslij('/api/sprawy', { tytul: 'Rozpoznawanie dokumentu' });
    const pismo = await api.wyslij(`/api/sprawy/${sprawa.tresc.sprawa.id}/pisma`, {
      kierunek: 'przychodzace', rodzaj: 'Pismo testowe', korespondent: 'Instytucja demonstracyjna',
    });
    return { api, sprawaId: sprawa.tresc.sprawa.id as number, pismoId: pismo.tresc.pismo.id as number };
  }

  it('odczytuje PNG, zachowuje wynik i wyszukuje po treści', { skip: !maOcr }, async () => {
    const { api, sprawaId, pismoId } = await przygotuj();
    const obraz = await readFile(new URL('./fixtures/skan-testowy.png', import.meta.url));
    const dodany = await api.przeslijPlik(pismoId, 'skan.png', obraz, 'tresc');
    const id = dodany.tresc.dokument.id;
    const wynik = await api.wyslij(`/api/dokumenty/${id}/ocr`, {});
    assert.equal(wynik.kod, 200);
    assert.match(wynik.tresc.ocr.tekst, /SPRAWNIK/);
    assert.match(wynik.tresc.ocr.tekst, /12345/);
    assert.equal(wynik.tresc.ocr.liczbaStron, 1);
    assert.equal((await api.pobierz(`/api/dokumenty/${id}/ocr`)).tresc.ocr.tekst, wynik.tresc.ocr.tekst);
    const bez = await api.pobierz(`/api/sprawy/${sprawaId}/dokumenty?szukaj=12345`);
    assert.equal(bez.tresc.dokumenty.length, 0);
    const zTekstem = await api.pobierz(`/api/sprawy/${sprawaId}/dokumenty?szukaj=12345&wTresci=true`);
    assert.equal(zTekstem.tresc.dokumenty.length, 1);
    assert.equal(zTekstem.tresc.dokumenty[0].ocrGotowy, true);
    const obcy = await zaloguj('ocr-obcy@example.com');
    assert.equal((await obcy.pobierz(`/api/dokumenty/${id}/ocr`)).kod, 404);
    assert.equal((await obcy.wyslij(`/api/dokumenty/${id}/ocr`, {})).kod, 404);
  });

  it('odczytuje skan PDF przez rasteryzację strony', { skip: !maOcr || !maPdf }, async () => {
    const { api, pismoId } = await przygotuj();
    const pdf = await readFile(new URL('./fixtures/skan-testowy.pdf', import.meta.url));
    const dodany = await api.przeslijPlik(pismoId, 'skan.pdf', pdf);
    const wynik = await api.wyslij(`/api/dokumenty/${dodany.tresc.dokument.id}/ocr`, {});
    assert.equal(wynik.kod, 200);
    assert.match(wynik.tresc.ocr.tekst, /SPRAWNIK/);
    assert.equal(wynik.tresc.ocr.liczbaStron, 1);
  });

  it('odrzuca nieobsługiwany format i uszkodzony obraz bez utraty oryginału', async () => {
    const { api, pismoId } = await przygotuj();
    const dokument = await api.przeslijPlik(pismoId, 'tekst.txt', Buffer.from('Zwykły tekst'));
    assert.equal((await api.wyslij(`/api/dokumenty/${dokument.tresc.dokument.id}/ocr`, {})).kod, 415);
    const uszkodzony = await api.przeslijPlik(pismoId, 'uszkodzony.png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const odpowiedz = await api.wyslij(`/api/dokumenty/${uszkodzony.tresc.dokument.id}/ocr`, {});
    assert.ok([422, 503].includes(odpowiedz.kod));
    assert.equal((await api.pobierzPlik(uszkodzony.tresc.dokument.id)).kod, 200);
  });
});

describe('skanowanie', () => {
  it('udostępnia fizyczne skanowanie wyłącznie administratorowi', async () => {
    const api = await zaloguj('skaner-user@example.com');
    assert.equal((await api.pobierz('/api/skanery')).kod, 403);
    assert.equal((await api.wyslij('/api/pisma/1/skan', { urzadzenie: 'test:0' })).kod, 403);
  });

  it('skanuje syntetyczną kartkę przez oficjalny backend testowy SANE', {
    skip: spawnSync('scanimage', ['--version']).status !== 0,
  }, async () => {
    const api = await zaloguj('skaner-admin@example.com', 'administrator');
    const sprawa = await api.wyslij('/api/sprawy', { tytul: 'Syntetyczny skan SANE' });
    const pismo = await api.wyslij(`/api/sprawy/${sprawa.tresc.sprawa.id}/pisma`, {
      kierunek: 'przychodzace', rodzaj: 'Pismo', korespondent: 'Test',
    });
    const stareWlaczenie = process.env.SCANNER_ENABLED;
    const staraKonfiguracja = process.env.SANE_CONFIG_DIR;
    process.env.SCANNER_ENABLED = 'true';
    process.env.SANE_CONFIG_DIR = new URL('./fixtures/sane/', import.meta.url).pathname;
    try {
      const lista = await api.pobierz('/api/skanery');
      assert.equal(lista.kod, 200);
      assert.equal(lista.tresc.wlaczone, true);
      assert.ok(lista.tresc.skanery.some((s: { id: string }) => s.id === 'test:0'));
      const wynik = await api.wyslij(`/api/pisma/${pismo.tresc.pismo.id}/skan`, { urzadzenie: 'test:0', dpi: 150, rola: 'tresc' });
      assert.equal(wynik.kod, 201);
      assert.equal(wynik.tresc.dokument.rola, 'tresc');
      const plik = await api.pobierzPlik(wynik.tresc.dokument.id);
      assert.deepEqual([...plik.plik.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      assert.equal((await api.wyslij(`/api/pisma/${pismo.tresc.pismo.id}/skan`, { urzadzenie: 'nieistniejacy', dpi: 150 })).kod, 400);
    } finally {
      if (stareWlaczenie === undefined) delete process.env.SCANNER_ENABLED; else process.env.SCANNER_ENABLED = stareWlaczenie;
      if (staraKonfiguracja === undefined) delete process.env.SANE_CONFIG_DIR; else process.env.SANE_CONFIG_DIR = staraKonfiguracja;
    }
  });
});


describe('skrzynka skanów i dopasowanie spraw', () => {
  let folder: string;
  let stareInbox: string | undefined;
  let stareArchiwum: string | undefined;
  beforeEach(async () => {
    folder = await mkdtemp('/tmp/sprawnik-inbox-test-');
    stareInbox = process.env.SCAN_INBOX_DIR; stareArchiwum = process.env.SCAN_ARCHIVE_DIR;
    process.env.SCAN_INBOX_DIR = path.join(folder, 'inbox');
    process.env.SCAN_ARCHIVE_DIR = path.join(folder, 'archive');
    for (const zrodlo of ['epson', 'kyocera']) await mkdir(path.join(folder, 'inbox', zrodlo), { recursive: true });
  });
  afterEach(async () => {
    if (stareInbox === undefined) delete process.env.SCAN_INBOX_DIR; else process.env.SCAN_INBOX_DIR = stareInbox;
    if (stareArchiwum === undefined) delete process.env.SCAN_ARCHIVE_DIR; else process.env.SCAN_ARCHIVE_DIR = stareArchiwum;
    await rm(folder, { recursive: true, force: true });
  });
  async function skan(zrodlo = 'epson', nazwa = 'skan.png', stary = true) {
    const plik = path.join(folder, 'inbox', zrodlo, nazwa);
    await writeFile(plik, await readFile(new URL('./fixtures/skan-testowy.png', import.meta.url)));
    if (stary) await utimes(plik, new Date(Date.now() - 20000), new Date(Date.now() - 20000));
    return Buffer.from(`${zrodlo}/${nazwa}`).toString('base64url');
  }
  async function przygotuj(zData = true) {
    const api = await zaloguj('inbox@example.com', 'administrator');
    const s = await api.wyslij('/api/sprawy', { tytul: 'Odczyt sprawy', znakWlasny: 'SPRAWNIK TEST OCR' });
    const p = await api.wyslij(`/api/sprawy/${s.tresc.sprawa.id}/pisma`, { kierunek: 'przychodzace', rodzaj: 'Pismo', korespondent: 'Test', dataDoreczenia: zData ? '2026-11-06' : null });
    return { api, sprawaId: s.tresc.sprawa.id, pismoId: p.tresc.pismo.id };
  }
  it('zapisuje datę wpływu na dysku przed wyborem sprawy i odczytuje ją przy kolejnym pobraniu listy', async () => {
    const api = await zaloguj('data-skanu@example.com', 'administrator');
    const user = await zaloguj('data-skanu-user@example.com');
    const id = await skan();
    assert.equal((await api.pobierz('/api/sprawy')).tresc.sprawy.length, 0);
    assert.equal((await user.zmien(`/api/skany/${id}/wplyw`, { dataWplywu: '2026-11-06' })).kod, 403);
    for (const data of ['', '2026-02-31', '2026-13-01']) {
      assert.equal((await api.zmien(`/api/skany/${id}/wplyw`, { dataWplywu: data })).kod, 400);
    }
    assert.equal((await api.zmien(`/api/skany/${id}/wplyw`, { dataWplywu: '2026-11-06', sha256: '0'.repeat(64) })).kod, 409);
    const zapis = await api.zmien(`/api/skany/${id}/wplyw`, { dataWplywu: '2026-11-06' });
    assert.equal(zapis.kod, 200);
    assert.equal(zapis.tresc.dataWplywu, '2026-11-06');
    assert.equal((await api.pobierz('/api/skany')).tresc.skany[0].dataWplywu, '2026-11-06');
    const katalogMetadanych = path.join(folder, 'archive', 'metadane-skanow');
    const metryka = path.join(katalogMetadanych, (await readdir(katalogMetadanych))[0]!);
    assert.equal(JSON.parse(await readFile(metryka, 'utf8')).dataWplywu, '2026-11-06');
    assert.equal((await stat(metryka)).mode & 0o777, 0o600);
    assert.equal((await api.zmien(`/api/skany/${id}/wplyw`, { dataWplywu: '2026-11-07' })).kod, 200);
    assert.equal((await api.pobierz('/api/skany')).tresc.skany[0].dataWplywu, '2026-11-07');
    const nowy = await skan('kyocera', 'odbierany.png', false);
    assert.equal((await api.zmien(`/api/skany/${nowy}/wplyw`, { dataWplywu: '2026-11-06' })).kod, 409);
  });
  it('nie przenosi zapisanej daty na ponowny skan tej samej nazwy i zachowuje ją w metryce kosza oraz importu', async () => {
    const { api, pismoId } = await przygotuj(false);
    const id = await skan();
    await api.zmien(`/api/skany/${id}/wplyw`, { dataWplywu: '2026-11-06' });
    await skan();
    assert.equal((await api.pobierz('/api/skany')).tresc.skany[0].dataWplywu, null);
    await api.zmien(`/api/skany/${id}/wplyw`, { dataWplywu: '2026-11-06' });
    const lista = await api.pobierz('/api/skany');
    await api.zmien(`/api/pisma/${pismoId}/doreczenie`, { dataDoreczenia: lista.tresc.skany[0].dataWplywu });
    assert.equal((await api.wyslij(`/api/skany/${id}/import`, { pismoId, rola: 'tresc' })).kod, 201);
    const metryka = (await readdir(path.join(folder, 'archive'))).find(f => f.endsWith('.json'))!;
    assert.equal(JSON.parse(await readFile(path.join(folder, 'archive', metryka), 'utf8')).dataWplywu, '2026-11-06');
    await skan();
    assert.equal((await api.pobierz('/api/skany')).tresc.skany[0].dataWplywu, null);
    await api.zmien(`/api/skany/${id}/wplyw`, { dataWplywu: '2026-11-08' });
    const usuniety = await api.wyslij(`/api/skany/${id}/kosz`, {});
    const metrykaKosza = path.join(folder, 'archive', 'kosz', usuniety.tresc.koszId, 'metryka.json');
    assert.equal(JSON.parse(await readFile(metrykaKosza, 'utf8')).dataWplywu, '2026-11-08');
  });
  it('pozwala ręcznie zapisać termin przy skanie, przelicza go po zmianie wpływu i przenosi do sprawy bez duplikatów', async () => {
    const { api, pismoId, sprawaId } = await przygotuj(false);
    const user = await zaloguj('termin-skanu-user@example.com');
    const id = await skan();
    const termin = { tryb: 'dni', liczbaDni: 7 };
    assert.equal((await user.zmien(`/api/skany/${id}/termin-odpowiedzi`, { termin, potwierdzono: true })).kod, 403);
    assert.equal((await api.wyslij(`/api/skany/${id}/termin-odpowiedzi/podglad`, termin)).kod, 400);
    await api.zmien(`/api/skany/${id}/wplyw`, { dataWplywu: '2026-11-06' });
    const podglad = await api.wyslij(`/api/skany/${id}/termin-odpowiedzi/podglad`, termin);
    assert.equal(podglad.tresc.terminOdpowiedzi.dataUplywu, '2026-11-13');
    assert.equal((await api.pobierz('/api/skany')).tresc.skany[0].terminOdpowiedzi, null);
    assert.equal((await api.zmien(`/api/skany/${id}/termin-odpowiedzi`, { termin, potwierdzono: false })).kod, 400);
    assert.equal((await api.zmien(`/api/skany/${id}/termin-odpowiedzi`, { termin, potwierdzono: true })).kod, 200);
    assert.equal((await api.pobierz('/api/skany')).tresc.skany[0].terminOdpowiedzi.dataUplywu, '2026-11-13');
    await api.zmien(`/api/skany/${id}/wplyw`, { dataWplywu: '2026-11-07' });
    assert.equal((await api.pobierz('/api/skany')).tresc.skany[0].terminOdpowiedzi.dataUplywu, '2026-11-14');
    await api.zmien(`/api/skany/${id}/wplyw`, { dataWplywu: '2026-11-06' });
    await api.zmien(`/api/pisma/${pismoId}/doreczenie`, { dataDoreczenia: '2026-11-06' });
    const imp = await api.wyslij(`/api/skany/${id}/import`, { pismoId, rola: 'tresc' });
    assert.equal(imp.kod, 201); assert.ok(imp.tresc.terminId);
    assert.equal((await api.pobierz(`/api/sprawy/${sprawaId}`)).tresc.terminy[0].dataUplywu, '2026-11-13');
    await skan();
    await api.zmien(`/api/skany/${id}/wplyw`, { dataWplywu: '2026-11-06' });
    await api.zmien(`/api/skany/${id}/termin-odpowiedzi`, { termin, potwierdzono: true });
    assert.equal((await api.wyslij(`/api/skany/${id}/import`, { pismoId, rola: 'tresc' })).kod, 201);
    assert.equal((await api.pobierz(`/api/sprawy/${sprawaId}`)).tresc.terminy.length, 1);
  });
  it('zapisuje konkretną datę sprzed wpływu z ostrzeżeniem, a ponowny skan nie dziedziczy terminu', async () => {
    const api = await zaloguj('termin-staly@example.com', 'administrator');
    const id = await skan();
    await api.zmien(`/api/skany/${id}/wplyw`, { dataWplywu: '2026-11-06' });
    const wynik = await api.zmien(`/api/skany/${id}/termin-odpowiedzi`, { termin: { tryb: 'data', dataUplywu: '2026-11-05' }, potwierdzono: true });
    assert.equal(wynik.kod, 200); assert.ok(wynik.tresc.terminOdpowiedzi.ostrzezenie);
    await api.zmien(`/api/skany/${id}/wplyw`, { dataWplywu: '2026-11-07' });
    assert.equal((await api.pobierz('/api/skany')).tresc.skany[0].terminOdpowiedzi.dataUplywu, '2026-11-05');
    await skan();
    assert.equal((await api.pobierz('/api/skany')).tresc.skany[0].terminOdpowiedzi, null);
  });
  it('chroni wspólną skrzynkę i wyświetla pliki obu urządzeń bez dowiązań', async () => {
    const user = await zaloguj('inbox-user@example.com');
    assert.equal((await user.pobierz('/api/skany')).kod, 403);
    const { api } = await przygotuj();
    await skan(); await skan('kyocera');
    await symlink(path.join(folder, 'inbox/epson/skan.png'), path.join(folder, 'inbox/epson/link.png'));
    const lista = await api.pobierz('/api/skany');
    assert.equal(lista.tresc.skany.length, 2);
    assert.equal((await api.wyslij(`/api/skany/${Buffer.from('epson/link.png').toString('base64url')}/rozpoznaj`, {})).kod, 404);
    assert.equal((await api.wyslij(`/api/skany/${Buffer.from('epson/../skan.png').toString('base64url')}/rozpoznaj`, {})).kod, 404);
    await rm(path.join(folder, 'inbox/kyocera'), { recursive: true });
    await symlink(path.join(folder, 'inbox/epson'), path.join(folder, 'inbox/kyocera'));
    assert.equal((await api.pobierz('/api/skany')).tresc.skany.length, 1);
    assert.equal((await api.wyslij(`/api/skany/${Buffer.from('kyocera/skan.png').toString('base64url')}/rozpoznaj`, {})).kod, 404);
  });
  it('przenosi skan do kosza z powodem, zachowuje plik i nie narusza dokumentów', async () => {
    const { api, pismoId } = await przygotuj();
    const id = await skan();
    const zapisany = await api.przeslijPlik(pismoId, 'zachowany.txt', Buffer.from('Zachowaj'));
    const zwykly = await zaloguj('kosz-user@example.com');
    assert.equal((await zwykly.wyslij(`/api/skany/${id}/kosz`, { powod: 'Ponowny skan' })).kod, 403);
    assert.equal((await api.wyslij(`/api/skany/${id}/kosz`, { powod: 'x'.repeat(501) })).kod, 400);
    const wynik = await api.wyslij(`/api/skany/${id}/kosz`, { powod: 'Ponowny skan' });
    assert.equal(wynik.kod, 200);
    const kosz = path.join(folder, 'archive', 'kosz', wynik.tresc.koszId);
    assert.deepEqual(await readFile(path.join(kosz, 'skan.png')), await readFile(new URL('./fixtures/skan-testowy.png', import.meta.url)));
    assert.equal(JSON.parse(await readFile(path.join(kosz, 'metryka.json'), 'utf8')).powod, 'Ponowny skan');
    assert.equal((await api.pobierz('/api/skany')).tresc.skany.length, 0);
    assert.equal((await api.pobierzPlik(zapisany.tresc.dokument.id)).plik.toString(), 'Zachowaj');
    assert.equal((await api.wyslij(`/api/skany/${id}/kosz`, {})).kod, 404);
    await skan();
    assert.equal((await api.pobierz('/api/skany')).tresc.skany.length, 1);
    const swiezy = await skan('kyocera', 'odbierany.png', false);
    assert.equal((await api.wyslij(`/api/skany/${swiezy}/kosz`, {})).kod, 409);
    await symlink(path.join(folder, 'inbox/epson/skan.png'), path.join(folder, 'inbox/epson/link.png'));
    const linkId = Buffer.from('epson/link.png').toString('base64url');
    assert.equal((await api.wyslij(`/api/skany/${linkId}/kosz`, {})).kod, 404);
  });
  it('zachowuje wpływ 06.11.2026 i termin według wskazanej reguły mimo późniejszego importu skanu', async () => {
    const { api, pismoId, sprawaId } = await przygotuj(false);
    const bezDaty = await skan();
    assert.equal((await api.wyslij(`/api/skany/${bezDaty}/import`, { pismoId, rola: 'tresc' })).kod, 400);
    assert.equal((await api.pobierz('/api/skany')).tresc.skany.length, 1);
    const regula = await api.wyslij('/api/reguly', { nazwa: 'Test wezwania — 7 dni', liczbaDni: 7,
      sposobLiczenia: 'dni_kalendarzowe', zdarzeniePoczatkowe: 'doreczenie', przesuwajDniWolne: false });
    const zapis = await api.zmien(`/api/pisma/${pismoId}/doreczenie`, { dataDoreczenia: '2026-11-06', regulaId: regula.tresc.regula.id });
    assert.equal(zapis.kod, 200);
    assert.equal(zapis.tresc.termin.dataPoczatkowa, '2026-11-06');
    assert.equal(zapis.tresc.termin.dataUplywu, '2026-11-13');
    const id = await skan();
    assert.equal((await api.wyslij(`/api/skany/${id}/import`, { pismoId, rola: 'tresc' })).kod, 201);
    assert.equal((await api.zmien(`/api/pisma/${pismoId}/doreczenie`, { dataDoreczenia: '2026-11-10' })).kod, 400);
    const stan = await api.pobierz(`/api/sprawy/${sprawaId}`);
    assert.equal(stan.tresc.pisma[0].dataDoreczenia, '2026-11-06');
    assert.equal(stan.tresc.terminy.length, 1);
    assert.equal(stan.tresc.terminy[0].dataUplywu, '2026-11-13');
  });
  it('nie odczytuje pliku podczas odbioru ani pliku przekraczającego limit', async () => {
    const { api } = await przygotuj();
    const id = await skan('epson', 'nowy.png', false);
    assert.equal((await api.wyslij(`/api/skany/${id}/rozpoznaj`, {})).kod, 409);
    const duzy = path.join(folder, 'inbox/epson/duzy.pdf');
    await writeFile(duzy, Buffer.alloc(10 * 1024 * 1024 + 1));
    await utimes(duzy, new Date(0), new Date(0));
    assert.equal((await api.wyslij(`/api/skany/${Buffer.from('epson/duzy.pdf').toString('base64url')}/rozpoznaj`, {})).kod, 413);
  });
  it('proponuje wyłącznie własne sprawy, wymaga wyboru przy niejednoznaczności i zachowuje OCR po imporcie', { skip: !maOcr }, async () => {
    const { api, sprawaId, pismoId } = await przygotuj();
    const obcy = await zaloguj('inbox-obcy@example.com');
    const obca = await obcy.wyslij('/api/sprawy', { tytul: 'Obca', znakWlasny: 'SPRAWNIK TEST OCR' });
    const obcePismo = await obcy.wyslij(`/api/sprawy/${obca.tresc.sprawa.id}/pisma`, { kierunek: 'przychodzace', rodzaj: 'Prywatne', korespondent: 'Test' });
    const id = await skan();
    const rozpoznanie = await api.wyslij(`/api/skany/${id}/rozpoznaj`, {});
    assert.equal(rozpoznanie.kod, 200);
    assert.equal(rozpoznanie.tresc.proponowanaSprawaId, sprawaId);
    assert.equal(rozpoznanie.tresc.propozycje.length, 1);
    await api.wyslij('/api/sprawy', { tytul: 'Drugie dopasowanie', znakWlasny: 'SPRAWNIK TEST OCR' });
    assert.equal((await api.wyslij(`/api/skany/${id}/rozpoznaj`, {})).tresc.proponowanaSprawaId, null);
    assert.equal((await api.wyslij(`/api/skany/${id}/import`, { pismoId: obcePismo.tresc.pismo.id })).kod, 404);
    assert.equal((await api.wyslij(`/api/skany/${id}/import`, { pismoId, sha256: '0'.repeat(64) })).kod, 409);
    const wynik = await api.wyslij(`/api/skany/${id}/import`, { pismoId, rola: 'tresc', sha256: rozpoznanie.tresc.sha256 });
    assert.equal(wynik.kod, 201);
    assert.equal(wynik.tresc.archiwizowano, true);
    assert.equal(wynik.tresc.dokument.nazwaWMagazynie, undefined);
    assert.equal(wynik.tresc.dokument.ocrGotowy, true);
    assert.match((await api.pobierz(`/api/dokumenty/${wynik.tresc.dokument.id}/ocr`)).tresc.ocr.tekst, /SPRAWNIK/);
    assert.deepEqual((await api.pobierzPlik(wynik.tresc.dokument.id)).plik, await readFile(new URL('./fixtures/skan-testowy.png', import.meta.url)));
    assert.equal((await api.pobierz('/api/skany')).tresc.skany.length, 0);
    assert.equal((await readdir(path.join(folder, 'archive'))).length, 2);
    assert.equal((await api.wyslij(`/api/skany/${id}/import`, { pismoId })).kod, 404);
    const kopia = await skan('kyocera', 'kopia.png');
    const ponownie = await api.wyslij(`/api/skany/${kopia}/import`, { pismoId, rola: 'tresc' });
    assert.equal(ponownie.tresc.dokument.id, wynik.tresc.dokument.id);
    assert.equal((await api.pobierz(`/api/sprawy/${sprawaId}/dokumenty`)).tresc.dokumenty.length, 1);
  });
});
