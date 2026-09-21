-- Migracja 002 — dane konfiguracyjne: reguły terminów i kalendarz dni wolnych
--
-- Obie tabele stanowią konfigurację mechanizmu wyznaczania terminów. Bez nich
-- aplikacja działa, ale nie ma czego stosować, dlatego wypełniane są migracją,
-- a nie ręcznie po wdrożeniu.

BEGIN;

-- Reguły terminów --------------------------------------------------------
--
-- Zestaw reprezentatywny, zgodny z demonstracyjnym charakterem projektu:
-- pokazuje oba sposoby liczenia dni oraz oba zdarzenia początkowe. Nie jest
-- odwzorowaniem kompletnych procedur administracyjnych — reguła jest wierszem
-- w tabeli, więc kolejne dodaje się bez zmiany aplikacji.

INSERT INTO regula_terminu
  (nazwa, liczba_dni, sposob_liczenia, zdarzenie_poczatkowe, przesuwaj_dni_wolne, opis)
VALUES
  ('Odwołanie od decyzji', 14, 'dni_kalendarzowe', 'doreczenie', true,
   'Termin na wniesienie odwołania od decyzji organu pierwszej instancji.'),
  ('Zażalenie na postanowienie', 7, 'dni_kalendarzowe', 'doreczenie', true,
   'Termin na wniesienie zażalenia na postanowienie.'),
  ('Uzupełnienie braków formalnych', 7, 'dni_kalendarzowe', 'doreczenie', true,
   'Termin na uzupełnienie braków wskazanych w wezwaniu.'),
  ('Skarga do sądu administracyjnego', 30, 'dni_kalendarzowe', 'doreczenie', true,
   'Termin na wniesienie skargi po wyczerpaniu środków zaskarżenia.'),
  ('Odpowiedź na wezwanie do wyjaśnień', 10, 'dni_robocze', 'doreczenie', true,
   'Przykład reguły liczonej w dniach roboczych — sposób liczenia jest cechą reguły, nie kodu.'),
  ('Wniesienie opłaty', 7, 'dni_kalendarzowe', 'doreczenie', false,
   'Przykład reguły bez przesuwania z dnia wolnego — zachowanie konfigurowane osobno dla każdej reguły.'),
  ('Wykonanie obowiązku od dnia nadania', 21, 'dni_kalendarzowe', 'nadanie', true,
   'Przykład reguły liczonej od daty nadania, stosowanej tam, gdzie doręczenie nie wyznacza biegu.');


-- Kalendarz dni ustawowo wolnych ------------------------------------------
--
-- Wyłącznie dni ustawowo wolne od pracy. Soboty i niedziele wynikają z samej
-- daty i nie są zapisywane — przechowywanie ich powielałoby informację, którą
-- data już niesie.
--
-- Dni ruchome wyznaczono algorytmem komputusu (Meeus/Jones/Butcher) względem
-- Niedzieli Wielkanocnej: Poniedziałek Wielkanocny +1, Zielone Świątki +49,
-- Boże Ciało +60. Zapisane jako konkretne daty, ponieważ tabela ma być czytelna
-- i sprawdzalna wprost, bez uruchamiania wyliczeń w bazie.
--
-- 24 grudnia ujęto jako dzień ustawowo wolny zgodnie z ustawą z 6 grudnia 2024 r.
-- o zmianie ustawy o dniach wolnych od pracy oraz niektórych innych ustaw
-- (Dz.U. 2024 poz. 1965), obowiązującą od 1 lutego 2025 r.
--
-- Zakres 2026-2030 odpowiada demonstracyjnemu charakterowi systemu. Wydłużenie
-- kalendarza polega na dopisaniu wierszy, nie na zmianie aplikacji.

INSERT INTO dzien_wolny (data, nazwa) VALUES
  -- 2026 (Niedziela Wielkanocna: 05.04)
  ('2026-01-01', 'Nowy Rok'),
  ('2026-01-06', 'Święto Trzech Króli'),
  ('2026-04-05', 'Niedziela Wielkanocna'),
  ('2026-04-06', 'Poniedziałek Wielkanocny'),
  ('2026-05-01', 'Święto Pracy'),
  ('2026-05-03', 'Święto Narodowe Trzeciego Maja'),
  ('2026-05-24', 'Zielone Świątki'),
  ('2026-06-04', 'Boże Ciało'),
  ('2026-08-15', 'Wniebowzięcie NMP / Święto Wojska Polskiego'),
  ('2026-11-01', 'Wszystkich Świętych'),
  ('2026-11-11', 'Narodowe Święto Niepodległości'),
  ('2026-12-24', 'Wigilia Bożego Narodzenia'),
  ('2026-12-25', 'Boże Narodzenie (pierwszy dzień)'),
  ('2026-12-26', 'Boże Narodzenie (drugi dzień)'),
  -- 2027 (Niedziela Wielkanocna: 28.03)
  ('2027-01-01', 'Nowy Rok'),
  ('2027-01-06', 'Święto Trzech Króli'),
  ('2027-03-28', 'Niedziela Wielkanocna'),
  ('2027-03-29', 'Poniedziałek Wielkanocny'),
  ('2027-05-01', 'Święto Pracy'),
  ('2027-05-03', 'Święto Narodowe Trzeciego Maja'),
  ('2027-05-16', 'Zielone Świątki'),
  ('2027-05-27', 'Boże Ciało'),
  ('2027-08-15', 'Wniebowzięcie NMP / Święto Wojska Polskiego'),
  ('2027-11-01', 'Wszystkich Świętych'),
  ('2027-11-11', 'Narodowe Święto Niepodległości'),
  ('2027-12-24', 'Wigilia Bożego Narodzenia'),
  ('2027-12-25', 'Boże Narodzenie (pierwszy dzień)'),
  ('2027-12-26', 'Boże Narodzenie (drugi dzień)'),
  -- 2028 (Niedziela Wielkanocna: 16.04)
  ('2028-01-01', 'Nowy Rok'),
  ('2028-01-06', 'Święto Trzech Króli'),
  ('2028-04-16', 'Niedziela Wielkanocna'),
  ('2028-04-17', 'Poniedziałek Wielkanocny'),
  ('2028-05-01', 'Święto Pracy'),
  ('2028-05-03', 'Święto Narodowe Trzeciego Maja'),
  ('2028-06-04', 'Zielone Świątki'),
  ('2028-06-15', 'Boże Ciało'),
  ('2028-08-15', 'Wniebowzięcie NMP / Święto Wojska Polskiego'),
  ('2028-11-01', 'Wszystkich Świętych'),
  ('2028-11-11', 'Narodowe Święto Niepodległości'),
  ('2028-12-24', 'Wigilia Bożego Narodzenia'),
  ('2028-12-25', 'Boże Narodzenie (pierwszy dzień)'),
  ('2028-12-26', 'Boże Narodzenie (drugi dzień)'),
  -- 2029 (Niedziela Wielkanocna: 01.04)
  ('2029-01-01', 'Nowy Rok'),
  ('2029-01-06', 'Święto Trzech Króli'),
  ('2029-04-01', 'Niedziela Wielkanocna'),
  ('2029-04-02', 'Poniedziałek Wielkanocny'),
  ('2029-05-01', 'Święto Pracy'),
  ('2029-05-03', 'Święto Narodowe Trzeciego Maja'),
  ('2029-05-20', 'Zielone Świątki'),
  ('2029-05-31', 'Boże Ciało'),
  ('2029-08-15', 'Wniebowzięcie NMP / Święto Wojska Polskiego'),
  ('2029-11-01', 'Wszystkich Świętych'),
  ('2029-11-11', 'Narodowe Święto Niepodległości'),
  ('2029-12-24', 'Wigilia Bożego Narodzenia'),
  ('2029-12-25', 'Boże Narodzenie (pierwszy dzień)'),
  ('2029-12-26', 'Boże Narodzenie (drugi dzień)'),
  -- 2030 (Niedziela Wielkanocna: 21.04)
  ('2030-01-01', 'Nowy Rok'),
  ('2030-01-06', 'Święto Trzech Króli'),
  ('2030-04-21', 'Niedziela Wielkanocna'),
  ('2030-04-22', 'Poniedziałek Wielkanocny'),
  ('2030-05-01', 'Święto Pracy'),
  ('2030-05-03', 'Święto Narodowe Trzeciego Maja'),
  ('2030-06-09', 'Zielone Świątki'),
  ('2030-06-20', 'Boże Ciało'),
  ('2030-08-15', 'Wniebowzięcie NMP / Święto Wojska Polskiego'),
  ('2030-11-01', 'Wszystkich Świętych'),
  ('2030-11-11', 'Narodowe Święto Niepodległości'),
  ('2030-12-24', 'Wigilia Bożego Narodzenia'),
  ('2030-12-25', 'Boże Narodzenie (pierwszy dzień)'),
  ('2030-12-26', 'Boże Narodzenie (drugi dzień)');

COMMIT;
