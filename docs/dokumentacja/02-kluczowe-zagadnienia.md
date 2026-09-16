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

<!-- Do napisania 17.09 — wraz z diagramem ERD. -->

## 2.3. Architektura aplikacji

<!-- Do napisania 18.09 — wraz z diagramem komponentów. -->

## 2.4. Kluczowe fragmenty implementacji

<!-- Do napisania 19-21.09, wraz z rozwojem kodu. -->
