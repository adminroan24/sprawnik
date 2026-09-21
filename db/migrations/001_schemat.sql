-- Migracja 001 — schemat bazy systemu Sprawnik
--
-- Odwzorowanie modelu danych opisanego w sekcji 2.2 dokumentacji projektowej
-- (docs/dokumentacja/02-kluczowe-zagadnienia.md) oraz na diagramie ERD
-- (docs/diagramy/model-danych.puml). Siedem tabel: cztery dziedzinowe
-- (sprawa, pismo, dokument, termin), jedna z kontami oraz dwie konfiguracyjne
-- (regula_terminu, dzien_wolny).

BEGIN;

-- Zbiory wartości zamknięte z natury zapisane jako typy wyliczeniowe, aby
-- ograniczenie zakresu wartości obowiązywało w bazie, a nie tylko w aplikacji.

CREATE TYPE rola_uzytkownika  AS ENUM ('uzytkownik', 'administrator');
CREATE TYPE status_sprawy     AS ENUM ('w_toku', 'zawieszona', 'zakonczona');
CREATE TYPE kierunek_pisma    AS ENUM ('przychodzace', 'wychodzace');
CREATE TYPE sposob_liczenia   AS ENUM ('dni_kalendarzowe', 'dni_robocze');
CREATE TYPE zdarzenie_poczatkowe AS ENUM ('doreczenie', 'nadanie');
CREATE TYPE sposob_wyznaczenia AS ENUM ('automatyczny', 'reczny');
CREATE TYPE status_terminu    AS ENUM ('otwarty', 'wykonany', 'anulowany');


CREATE TABLE uzytkownik (
  id            bigserial PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  haslo_hash    text NOT NULL,
  imie_nazwisko text NOT NULL,
  rola          rola_uzytkownika NOT NULL DEFAULT 'uzytkownik',
  aktywny       boolean NOT NULL DEFAULT true,
  utworzono     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN uzytkownik.haslo_hash IS
  'Skrót bcrypt. System nie przechowuje hasła w postaci pozwalającej je odtworzyć.';


CREATE TABLE sprawa (
  id             bigserial PRIMARY KEY,
  uzytkownik_id  bigint NOT NULL REFERENCES uzytkownik (id) ON DELETE RESTRICT,
  tytul          text NOT NULL,
  znak_wlasny    text,
  organ          text,
  status         status_sprawy NOT NULL DEFAULT 'w_toku',
  data_wszczecia date,
  opis           text,
  utworzono      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sprawa_tytul_niepusty CHECK (length(btrim(tytul)) > 0)
);

-- Usunięcie konta prowadzącego sprawy jest blokowane (ON DELETE RESTRICT):
-- sprawa bez osoby odpowiedzialnej traci możliwość przypisania dostępu.


CREATE TABLE pismo (
  id              bigserial PRIMARY KEY,
  sprawa_id       bigint NOT NULL REFERENCES sprawa (id) ON DELETE CASCADE,
  kierunek        kierunek_pisma NOT NULL,
  rodzaj          text NOT NULL,
  korespondent    text NOT NULL,
  znak_pisma      text,
  data_nadania    date,
  data_doreczenia date,
  opis            text,
  utworzono       timestamptz NOT NULL DEFAULT now(),
  -- Doręczenie nie może poprzedzać nadania. Warunek pomijany, gdy którakolwiek
  -- z dat pozostaje nieznana — pismo bywa rejestrowane przed potwierdzeniem odbioru.
  CONSTRAINT pismo_doreczenie_po_nadaniu CHECK (
    data_nadania IS NULL OR data_doreczenia IS NULL OR data_doreczenia >= data_nadania
  )
);

COMMENT ON COLUMN pismo.data_doreczenia IS
  'Może pozostać pusta. Dopóki jest pusta, termin nie powstaje — liczenie od daty '
  'nadania dawałoby wynik systematycznie zaniżony.';


CREATE TABLE regula_terminu (
  id                   bigserial PRIMARY KEY,
  nazwa                text NOT NULL UNIQUE,
  liczba_dni           integer NOT NULL,
  sposob_liczenia      sposob_liczenia NOT NULL,
  zdarzenie_poczatkowe zdarzenie_poczatkowe NOT NULL DEFAULT 'doreczenie',
  przesuwaj_dni_wolne  boolean NOT NULL DEFAULT true,
  opis                 text,
  aktywna              boolean NOT NULL DEFAULT true,
  utworzono            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regula_liczba_dni_dodatnia CHECK (liczba_dni > 0)
);

COMMENT ON TABLE regula_terminu IS
  'Konfiguracja sposobu wyznaczania terminu. Dodanie reguły jest operacją na danych '
  'i nie wymaga zmiany aplikacji.';


CREATE TABLE termin (
  id                 bigserial PRIMARY KEY,
  sprawa_id          bigint NOT NULL REFERENCES sprawa (id) ON DELETE CASCADE,
  pismo_id           bigint REFERENCES pismo (id) ON DELETE CASCADE,
  regula_id          bigint REFERENCES regula_terminu (id) ON DELETE RESTRICT,
  czynnosc           text NOT NULL,
  data_poczatkowa    date NOT NULL,
  data_uplywu        date NOT NULL,
  sposob_wyznaczenia sposob_wyznaczenia NOT NULL,
  status             status_terminu NOT NULL DEFAULT 'otwarty',
  data_wykonania     date,
  utworzono          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT termin_uplyw_po_poczatku CHECK (data_uplywu >= data_poczatkowa),
  -- Termin wyznaczony automatycznie musi dać się odtworzyć, więc zachowuje
  -- odniesienie do pisma i reguły, z których powstał.
  CONSTRAINT termin_automatyczny_ma_podstawe CHECK (
    sposob_wyznaczenia <> 'automatyczny' OR (pismo_id IS NOT NULL AND regula_id IS NOT NULL)
  ),
  CONSTRAINT termin_data_wykonania_tylko_przy_wykonanym CHECK (
    (status = 'wykonany') = (data_wykonania IS NOT NULL)
  )
);

COMMENT ON TABLE termin IS
  'Stany „zbliżający się" i „przekroczony" nie są przechowywane — wynikają '
  'z porównania data_uplywu z datą bieżącą. Kolumna status opisuje decyzję użytkownika.';


CREATE TABLE dokument (
  id                  bigserial PRIMARY KEY,
  pismo_id            bigint NOT NULL REFERENCES pismo (id) ON DELETE CASCADE,
  dodal_uzytkownik_id bigint NOT NULL REFERENCES uzytkownik (id) ON DELETE RESTRICT,
  nazwa_oryginalna    text NOT NULL,
  nazwa_w_magazynie   text NOT NULL UNIQUE,
  typ_mime            text NOT NULL,
  rozmiar_bajtow      bigint NOT NULL,
  suma_kontrolna      text,
  dodano              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dokument_rozmiar_dodatni CHECK (rozmiar_bajtow > 0)
);

COMMENT ON COLUMN dokument.nazwa_w_magazynie IS
  'Nazwa pliku na wolumenie. Treść pliku pozostaje poza bazą; suma kontrolna '
  'pozwala wykryć, że plik przestał odpowiadać opisowi.';


CREATE TABLE dzien_wolny (
  data  date PRIMARY KEY,
  nazwa text NOT NULL
);

COMMENT ON TABLE dzien_wolny IS
  'Wyłącznie dni ustawowo wolne, w tym ruchome. Soboty i niedziele wynikają '
  'z samej daty i nie są zapisywane.';


-- Indeksy pod zapytania wykonywane w każdym widoku aplikacji: lista spraw
-- użytkownika, zawartość sprawy oraz przegląd terminów otwartych według daty upływu.

CREATE INDEX sprawa_uzytkownik_idx  ON sprawa (uzytkownik_id);
CREATE INDEX pismo_sprawa_idx       ON pismo (sprawa_id);
CREATE INDEX dokument_pismo_idx     ON dokument (pismo_id);
CREATE INDEX termin_sprawa_idx      ON termin (sprawa_id);
CREATE INDEX termin_otwarte_idx     ON termin (data_uplywu) WHERE status = 'otwarty';

COMMIT;
