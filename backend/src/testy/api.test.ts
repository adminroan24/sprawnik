/**
 * Testy tras API — sprawdzają aplikację od strony żądania HTTP, wraz z bazą.
 *
 * Uzupełniają testy silnika terminów, które działają bez serwera: tutaj
 * przedmiotem sprawdzenia jest to, czy warstwy poskładane razem zachowują się
 * zgodnie z przypadkami użycia — łącznie z powstawaniem terminu przy
 * rejestracji pisma oraz z rozdzieleniem dostępu między użytkownikami.
 */

import { strict as assert } from 'node:assert';
import { after, before, beforeEach, describe, it } from 'node:test';
import * as uzytkownicy from '../db/uzytkownicy.js';
import { zahaszujHaslo } from '../services/uwierzytelnianie.js';
import { createHash } from 'node:crypto';
import { writeFile, unlink, rm } from 'node:fs/promises';
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
