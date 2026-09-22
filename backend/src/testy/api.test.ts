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
