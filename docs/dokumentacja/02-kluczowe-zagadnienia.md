# 2. Kluczowe zagadnienia związane z realizacją projektu

<!-- Limit szablonu: 3-5 stron łącznie. Sekcja obejmuje przypadki użycia,
     model danych z diagramem ERD, architekturę z diagramem komponentów
     oraz kluczowe fragmenty implementacji. -->

## 2.1. Przypadki użycia

### Aktorzy

| Aktor | Opis |
|-------|------|
| **Użytkownik** | Osoba prowadząca sprawy — własne lub powierzone. Rejestruje sprawy i korespondencję, dołącza dokumenty, korzysta z wyznaczonych terminów i chronologii. |
| **Administrator** | Zarządza regułami wyznaczania terminów oraz kontami i uprawnieniami użytkowników. Reguły są danymi konfiguracyjnymi, więc ich definiowanie nie wymaga zmiany aplikacji. |
| **Zegar systemowy** | Aktor czasu. Cyklicznie uruchamia ocenę stanu terminów, dzięki czemu ostrzeżenie o terminie zbliżającym się lub przekroczonym powstaje bez udziału użytkownika. |

### Wykaz przypadków użycia

| ID | Przypadek użycia | Aktor | Funkcja |
|----|------------------|-------|---------|
| UC1 | Rejestracja sprawy | Użytkownik | F1 |
| UC2 | Przegląd i edycja sprawy | Użytkownik | F1 |
| UC3 | Rejestracja pisma przychodzącego | Użytkownik | F2 |
| UC4 | Rejestracja pisma wychodzącego | Użytkownik | F2 |
| UC5 | Dołączenie dokumentu | Użytkownik | F3 |
| UC6 | Definiowanie reguły terminu | Administrator | F4 |
| UC7 | Wyznaczenie terminu | *(zawierany przez UC3)* | F4 |
| UC8 | Przegląd terminów | Użytkownik | F5 |
| UC9 | Ostrzeganie o terminach | Zegar systemowy | F5 |
| UC10 | Wyszukiwanie i filtrowanie | Użytkownik | F6 |
| UC11 | Generowanie chronologii sprawy | Użytkownik | F7 |
| UC12 | Uwierzytelnienie | Użytkownik, Administrator | F8 |
| UC13 | Zarządzanie użytkownikami | Administrator | F8 |

Kolumna „Funkcja" odsyła do zakresu podstawowego F1–F8 uzgodnionego z promotorem.

![](../diagramy/przypadki-uzycia.png)

*Rys. 1. Diagram przypadków użycia — zakres podstawowy.*

Dostęp do wszystkich przypadków użycia poza UC12 wymaga uwierzytelnienia.
Zależność ta nie została naniesiona na diagram jako trzynaście relacji
`«include»`, ponieważ zaciemniłaby obraz, nie wnosząc informacji.

### UC3 — Rejestracja pisma przychodzącego

Przypadek kluczowy dla całego systemu: to w nim powstaje termin, a więc
realizuje się główna teza projektu — że punktem odniesienia jest data
doręczenia, a nie data nadania.

**Aktor:** Użytkownik

**Warunek wstępny:** użytkownik uwierzytelniony, sprawa istnieje w systemie

**Przebieg główny**

1. Użytkownik wybiera sprawę i wskazuje rejestrację pisma przychodzącego.
2. Podaje nadawcę, znak pisma, rodzaj pisma oraz **datę nadania i datę doręczenia**
   jako dwie odrębne wartości.
3. Wskazuje regułę terminu właściwą dla czynności, której pismo dotyczy.
4. System zapisuje pismo i przypisuje je do sprawy.
5. System wyznacza termin (UC7) — relacja `«include»`, bo krok wykonuje się zawsze.
6. Wyznaczony termin pojawia się na liście terminów sprawy.

**Wynik:** pismo zarejestrowane, termin wyznaczony i widoczny w sprawie.

**Przebiegi alternatywne**

| Sytuacja | Zachowanie systemu |
|----------|--------------------|
| Data doręczenia nieznana | Pismo zostaje zapisane bez terminu i oznaczone jako oczekujące na potwierdzenie doręczenia. Termin powstaje dopiero po uzupełnieniu daty — system nie liczy terminu od daty nadania, bo byłoby to liczenie błędne. |
| Brak reguły dla danej czynności | Użytkownik wprowadza termin ręcznie; pozostaje on oznaczony jako wyznaczony ręcznie, nie automatycznie. |
| Dokument w postaci pliku | Krok opcjonalny — dołączenie dokumentu (UC5), relacja `«extend»`. |

### UC7 — Wyznaczenie terminu

**Aktor:** brak aktora bezpośredniego — przypadek zawierany przez UC3.

Reguła terminu jest zestawem danych, nie fragmentem kodu: określa nazwę,
liczbę dni, sposób ich liczenia oraz zdarzenie początkowe. Wyznaczenie terminu
polega na zastosowaniu reguły do daty doręczenia:

1. Odczytanie reguły wskazanej dla pisma.
2. Przyjęcie daty doręczenia jako punktu początkowego.
3. Dodanie liczby dni zgodnie ze sposobem liczenia zapisanym w regule
   (dni kalendarzowe albo robocze).
4. Przesunięcie terminu przypadającego na dzień wolny na najbliższy dzień roboczy.
5. Zapisanie terminu wraz z odniesieniem do pisma i reguły, na podstawie
   których powstał.

Krok 5 jest istotny dla wiarygodności systemu: przy każdym terminie zachowana
zostaje informacja, z jakiego pisma i jakiej reguły wynika, dzięki czemu
wyliczenie można odtworzyć i sprawdzić.

### UC9 — Ostrzeganie o terminach

**Aktor:** Zegar systemowy

Cykliczne przejrzenie terminów otwartych i zakwalifikowanie każdego z nich do
jednego ze stanów: odległy, zbliżający się, przekroczony. Progi są
konfigurowalne. Ostrzeżenie nie modyfikuje terminu — zmienia wyłącznie sposób
jego prezentacji użytkownikowi (UC8).

## 2.2. Model danych

Model obejmuje siedem tabel. Cztery odwzorowują przedmiot pracy (sprawa, pismo,
dokument, termin), jedna użytkowników, a dwie stanowią konfigurację mechanizmu
wyznaczania terminów (reguła terminu, kalendarz dni wolnych).

| Tabela | Rola w systemie |
|--------|-----------------|
| `uzytkownik` | Konta i role. Rozróżnienie użytkownika od administratora decyduje o dostępie do reguł terminów i zarządzania kontami. |
| `sprawa` | Jednostka nadrzędna. Grupuje korespondencję, dokumenty i terminy jednego postępowania. |
| `pismo` | Pojedyncza przesyłka przychodząca lub wychodząca. Nośnik dat, od których liczą się terminy. |
| `dokument` | Plik załączony do pisma wraz z metadanymi pozwalającymi zweryfikować jego tożsamość. |
| `regula_terminu` | Konfiguracja sposobu wyznaczania terminu. Dane, nie kod. |
| `termin` | Wyznaczony termin wraz ze śladem pochodzenia. |
| `dzien_wolny` | Kalendarz dni ustawowo wolnych, wykorzystywany przy liczeniu dni roboczych. |

![](../diagramy/model-danych.png)

*Rys. 2. Diagram związków encji (notacja Information Engineering).*

### Decyzje projektowe

**Data nadania i data doręczenia są osobnymi polami, a doręczenie może
pozostać nieznane.** To odwzorowanie głównego założenia projektu. Kolumna
`pismo.data_doreczenia` dopuszcza wartość pustą — pismo bywa zarejestrowane,
zanim potwierdzenie odbioru dotrze do prowadzącego sprawę. Dopóki pozostaje
pusta, termin nie powstaje. Alternatywą byłoby liczenie od daty nadania, ale
dawałoby to wynik systematycznie zaniżony, czyli błędny w sposób niebezpieczny
dla użytkownika.

**Reguła terminu jest wierszem w tabeli, nie gałęzią w kodzie.** Tabela
`regula_terminu` opisuje termin czterema cechami: liczbą dni, sposobem ich
liczenia, zdarzeniem początkowym oraz tym, czy termin przypadający na dzień
wolny przesuwa się na najbliższy roboczy. Dodanie nowej reguły jest operacją
na danych i nie wymaga zmiany aplikacji ani jej ponownego wdrożenia.

**Termin przechowuje ślad swojego pochodzenia.** Oprócz daty upływu zapisywane
są: pismo będące podstawą (`pismo_id`), zastosowana reguła (`regula_id`) oraz
data przyjęta za początek biegu (`data_poczatkowa`). Dzięki temu każde
wyliczenie można odtworzyć i sprawdzić, zamiast przyjmować wynik na wiarę.
Przy terminie wprowadzonym ręcznie oba odniesienia pozostają puste, a kolumna
`sposob_wyznaczenia` odróżnia go od wyznaczonego automatycznie.

**Stany „zbliżający się" i „przekroczony" nie są przechowywane.** Wynikają
z porównania `data_uplywu` z datą bieżącą i konfigurowalnym progiem ostrzegania.
Zapisane w bazie dezaktualizowałyby się nazajutrz i wymagałyby cyklicznego
przeliczania całej tabeli. Przechowywany jest wyłącznie `status` opisujący
decyzję użytkownika: termin otwarty, wykonany albo anulowany.

**Kalendarz dni wolnych jest osobną tabelą.** Bez niej pojęcia „dni robocze"
oraz „przesunięcie terminu z dnia wolnego" nie dają się zdefiniować.
`dzien_wolny` nie wchodzi w relacje z pozostałymi tabelami — jest czytana
w trakcie wyznaczania terminu.

**Dokument należy do pisma, a przez nie do sprawy.** Rozważono przypisanie
dokumentu bezpośrednio do sprawy, co pozwoliłoby przechowywać pliki niezwiązane
z żadną przesyłką. Odrzucono je, ponieważ rozmywałoby odpowiedź na pytanie,
czego dowodzi dany plik. Obok nazwy pierwotnej zapisywana jest nazwa w magazynie
oraz suma kontrolna, co pozwala wykryć podmianę pliku.

**Chronologia sprawy nie ma własnej tabeli.** Powstaje jako zapytanie łączące
pisma, terminy i dokumenty jednej sprawy, uporządkowane datą. Osobna tabela
zdarzeń dublowałaby dane już zapisane i wymagałaby utrzymywania ich w zgodzie.

### Typy wyliczeniowe i ograniczenia

Zbiory wartości zamknięte z natury zapisano jako typy wyliczeniowe PostgreSQL:
`rola_uzytkownika`, `status_sprawy`, `kierunek_pisma`, `sposob_liczenia`,
`zdarzenie_poczatkowe`, `sposob_wyznaczenia`, `status_terminu`. Ogranicza to
zakres dopuszczalnych wartości na poziomie bazy, a nie wyłącznie aplikacji.

Spójność wspierają ograniczenia sprawdzające. Najistotniejsze z nich:

| Ograniczenie | Cel |
|--------------|-----|
| `data_doreczenia >= data_nadania` | Doręczenie nie może poprzedzać nadania. |
| `data_uplywu >= data_poczatkowa` | Termin nie może upływać przed rozpoczęciem biegu. |
| `liczba_dni > 0` | Reguła musi wyznaczać termin dodatni. |
| termin automatyczny wymaga `regula_id` i `pismo_id` | Wyliczenie bez podstawy nie jest odtwarzalne. |
| `data_wykonania` tylko przy statusie `wykonany` | Data wykonania bez wykonania jest sprzeczna. |

Usunięcie sprawy kasuje kaskadowo jej pisma, dokumenty i terminy, ponieważ
poza sprawą tracą one sens. Usunięcie reguły, do której odwołują się terminy,
jest blokowane — inaczej znikłaby podstawa wyliczeń już dokonanych.

## 2.3. Architektura aplikacji

<!-- Do napisania 18.09 — wraz z diagramem komponentów. -->

## 2.4. Kluczowe fragmenty implementacji

<!-- Do napisania 19-21.09, wraz z rozwojem kodu. -->
