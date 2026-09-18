# 1. Podstawowe informacje

<!-- Limit szablonu: maks. 4 strony łącznie z wszystkimi podpunktami. -->

## Nazwa projektu

Projekt i implementacja systemu wspomagania zarządzania korespondencją
i terminami w postępowaniach administracyjnych.

## Cel projektu

W postępowaniach prowadzonych z instytucjami obowiązują terminy o skutkach
nieodwracalnych. Ich przekroczenie powoduje utratę prawa do wniesienia środka
odwoławczego, pozostawienie sprawy bez rozpoznania albo powstanie zobowiązania
finansowego. Liczy się je od daty doręczenia pisma, nie od daty jego nadania,
a długość i sposób liczenia różnią się w zależności od czynności.

Mimo tych konsekwencji sprawy prowadzi się zwykle w folderach i arkuszach
kalkulacyjnych, a terminów pilnuje pamięcią albo przypomnieniami w kalendarzu.
Sposób ten nie skaluje się przy kilku równoległych sprawach i nie zabezpiecza
przed pomyłką w samym liczeniu — a pomyłka o jeden dzień bywa równie dotkliwa
jak całkowite zaniedbanie sprawy.

Celem projektu jest aplikacja webowa, która gromadzi sprawy, korespondencję
i dokumenty w jednym miejscu, wyznacza terminy automatycznie na podstawie daty
doręczenia i konfigurowalnych reguł, ostrzega o terminach zbliżających się
i przekroczonych oraz pozwala odtworzyć chronologię sprawy. System adresowany
jest do osób prowadzących własne sprawy oraz do niewielkich podmiotów
obsługujących sprawy klientów.

## Krótki opis projektu

Sprawnik jest aplikacją webową złożoną z interfejsu przeglądarkowego,
serwerowego API oraz relacyjnej bazy danych.

Użytkownik zakłada sprawę i rejestruje w niej pisma przychodzące oraz
wychodzące, odnotowując przy każdym datę nadania i — odrębnie — datę
doręczenia. Do pisma dołącza dokumenty. Po wskazaniu reguły właściwej dla danej
czynności system wyznacza termin: dodaje do daty doręczenia liczbę dni zapisaną
w regule, licząc je w dniach kalendarzowych albo roboczych, a termin przypadający
na dzień wolny przesuwa na najbliższy dzień roboczy. Wyznaczony termin zachowuje
odniesienie do pisma i reguły, z których wynika, więc pozostaje sprawdzalny.

Terminy prezentowane są w układzie pozwalającym dostrzec te zbliżające się
i przekroczone. Reguły wyznaczania terminów są danymi konfiguracyjnymi —
dodanie nowej nie wymaga zmiany aplikacji. Projekt ma charakter demonstracyjny
i inżynierski: nie odwzorowuje kompletnych procedur administracyjnych, lecz
pokazuje działanie mechanizmu na reprezentatywnym zestawie reguł.

## Analiza konkurencji

Zadanie, które realizuje Sprawnik, bywa dziś wykonywane czterema sposobami.
Żaden z nich nie łączy rejestru korespondencji z regułowym wyznaczaniem
terminów od daty doręczenia.

**Arkusz kalkulacyjny z kalendarzem.** Rozwiązanie najczęstsze wśród osób
prowadzących własne sprawy. Zaletą jest zerowy koszt, natychmiastowa dostępność
i pełna swoboda układu. Wadą — że termin liczy człowiek. Arkusz nie odróżnia
daty nadania od daty doręczenia, nie zna dni ustawowo wolnych i nie przesunie
terminu wypadającego w święto. Dokumenty pozostają w folderach, bez powiązania
z wierszem arkusza, a przy kilku sprawach równoległych całość przestaje być
przeglądalna.

**Systemy elektronicznego zarządzania dokumentacją (EZD).** Rozbudowane
rozwiązania stosowane w urzędach, obsługujące obieg pism, dekretację i archiwum.
Zaletą jest kompletność i zgodność z instrukcją kancelaryjną. Wadą — że
zbudowano je z perspektywy organu prowadzącego postępowanie, nie strony.
Wdrożenie i utrzymanie przekracza możliwości osoby prywatnej lub małego
podmiotu, a pilnowanie własnych terminów procesowych nie jest ich zadaniem.

**Systemy kancelaryjne dla prawników.** Obsługują repertorium spraw, rozliczenia
i kalendarz czynności. Zaletą jest dojrzałość i powiązanie sprawy z terminami.
Wadą — skierowanie do kancelarii jako organizacji: model licencyjny, zakres
funkcji i nakład wdrożeniowy odpowiadają podmiotowi prowadzącemu sprawy
zawodowo, a nie osobie prowadzącej kilka spraw własnych.

**Ogólne narzędzia do zarządzania zadaniami.** Aplikacje z terminami
i przypomnieniami. Zaletą jest niski próg wejścia i dobre powiadomienia. Wadą
zasadniczą — że termin trzeba do nich wpisać samodzielnie, już wyliczony.
Narzędzie nie wie, czym jest data doręczenia, i nie odtworzy, skąd wzięła się
data w przypomnieniu.

| Kryterium                       | Arkusz | EZD | Kanc. | Zadania | Sprawnik |
|------------------------|:------:|:------:|:------:|:-------:|:----------:|
| Rejestr korespondencji          | part.  | tak | tak   | nie     | tak      |
| Odrębna data doręczenia         | nie    | tak | tak   | nie     | tak      |
| Wyznaczanie terminu z reguły    | nie    | nie | part. | nie     | tak      |
| Uwzględnianie dni wolnych       | nie    | nie | part. | nie     | tak      |
| Odtwarzalność wyliczenia        | nie    | nie | nie   | nie     | tak      |
| Dostępność dla osoby prywatnej  | tak    | nie | nie   | tak     | tak      |

Skróty: *Kanc.* — system kancelaryjny, *Zadania* — ogólny menedżer zadań,
*part.* — funkcja obecna częściowo lub zależna od konfiguracji.

Nisza, którą zajmuje projekt, leży między arkuszem a systemem kancelaryjnym:
narzędzie na tyle proste, by prowadzić w nim kilka spraw własnych, i na tyle
świadome sposobu liczenia terminów, by nie zostawiać tego rachunku człowiekowi.

<!-- Uwaga robocza: porównanie oparte na kategoriach rozwiązań, bez wskazywania
     konkretnych produktów i ich cen. Przed oddaniem rozważyć uzupełnienie
     o dwa-trzy nazwane przykłady, po sprawdzeniu aktualnego stanu ich funkcji. -->

## Wykaz zastosowanych technologii

- Node.js 24.19 — środowisko uruchomieniowe warstwy serwerowej
- TypeScript 5.9 — język warstwy serwerowej i frontendowej
- Express 5.2 — obsługa żądań HTTP i tras REST
- React 19.3 — warstwa frontendowa
- Vite 7.3 — narzędzie budujące i serwer deweloperski frontendu
- PostgreSQL 17.10 — relacyjna baza danych
- pg 8.23 — sterownik bazy danych dla Node.js
- Docker Compose 2.40 — uruchomienie środowiska
- PlantUML 1.2025.4 — diagramy generowane ze źródeł tekstowych

## Opis stosu technologicznego i uzasadnienie wybranych technologii

Warstwa frontendowa zbudowana w React komunikuje się z API wyłącznie przez HTTP
i format JSON. API zrealizowane w Express przyjmuje żądania, sprawdza token
uwierzytelniający i przekazuje operację warstwie dziedzinowej, która korzysta
z bazy PostgreSQL przez sterownik pg i pulę połączeń. Pliki dokumentów trafiają
na wolumen systemu plików, a w bazie pozostają ich metadane. Całość środowiska
opisuje Docker Compose.

**Jeden język w obu warstwach.** TypeScript po stronie serwera i przeglądarki
pozwala opisać te same struktury danych — sprawę, pismo, termin — jednym
zestawem typów, zamiast utrzymywać dwa równoległe opisy w różnych językach.
Przy projekcie prowadzonym przez jedną osobę ogranicza to koszt przełączania
kontekstu, a statyczne typowanie wyłapuje niezgodność formatu odpowiedzi API
z oczekiwaniem interfejsu w czasie kompilacji, nie w czasie działania.

**PostgreSQL zamiast bazy nierelacyjnej.** Dane projektu są z natury relacyjne:
sprawa zawiera pisma, pismo rodzi terminy, dokument należy do pisma. Baza
relacyjna pozwala wymusić te zależności więzami klucza obcego i ograniczeniami
sprawdzającymi, zamiast pilnować ich wyłącznie w kodzie aplikacji. Istotna jest
też arytmetyka dat i typy wyliczeniowe, bez których liczenie terminów wymagałoby
przenoszenia logiki do warstwy aplikacji. Wybór PostgreSQL wobec innych baz
relacyjnych wynika z dojrzałej obsługi typów wyliczeniowych i dat oraz
z perspektywy zakresu dodatkowego — wbudowanego wyszukiwania pełnotekstowego,
które pozwoli rozszerzyć projekt bez wprowadzania osobnego mechanizmu.

**Express zamiast rozbudowanego szkieletu aplikacji.** Zakres podstawowy
obejmuje kilkanaście tras REST. Szkielet narzucający własną strukturę wniósłby
warstwę pojęć przewyższającą złożonością samo zadanie i zaciemniłby podział
odpowiedzialności, który projekt ma pokazywać. Express pozostawia ten podział
decyzji projektowej, co przy dokumentowanej architekturze jest zaletą.

**Docker Compose do uruchomienia bazy.** Pozwala odtworzyć środowisko jednym
poleceniem i uniezależnia projekt od wersji PostgreSQL zainstalowanej
w systemie operacyjnym. Dla pracy ocenianej przez osobę trzecią powtarzalność
uruchomienia jest wartością samą w sobie.
