# Sprawnik

[![Testy i kontrola typów](https://github.com/adminroan24/sprawnik/actions/workflows/ci.yml/badge.svg)](https://github.com/adminroan24/sprawnik/actions/workflows/ci.yml)

System wspomagania zarządzania korespondencją i terminami w postępowaniach administracyjnych.

Projekt inżynierski — Uniwersytet VIZJA, kierunek Informatyka.

## Problem

W sprawach prowadzonych z instytucjami terminy liczone są od daty doręczenia pisma, różnią się
w zależności od czynności, a ich przekroczenie wywołuje skutki nieodwracalne. Mimo to
korespondencja i terminy prowadzone są zwykle ręcznie — w folderach i arkuszach kalkulacyjnych.

## Cel

Aplikacja webowa, która pozwala prowadzić rejestr spraw i korespondencji, automatycznie wyznacza
terminy na podstawie konfigurowalnych reguł i ostrzega o terminach zbliżających się
oraz przekroczonych.

## Zakres podstawowy

1. Rejestracja i obsługa spraw
2. Rejestracja korespondencji przychodzącej i wychodzącej
3. Dołączanie dokumentów do spraw
4. Definiowanie reguł terminów i automatyczne ich wyznaczanie
5. Prezentacja terminów i ostrzeganie o zbliżających się oraz przekroczonych
6. Wyszukiwanie i filtrowanie spraw oraz dokumentów
7. Generowanie chronologii sprawy
8. Uwierzytelnianie użytkowników i podstawowe zarządzanie uprawnieniami

## Zakres dodatkowy

Realizowany po ukończeniu zakresu podstawowego: wyszukiwanie pełnotekstowe w treści dokumentów,
panel statystyk, eksport kompletnych akt.

## Stos technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Frontend | React, TypeScript |
| Backend | Node.js, TypeScript, REST API |
| Baza danych | PostgreSQL |
| Uruchomienie | Docker Compose |

## Uruchomienie

Wymagania: Node.js 20+, Docker z wtyczką Compose.

```bash
cp .env.example backend/.env  # uzupełnij wartości; API odczytuje .env z backend/
docker compose up -d db       # PostgreSQL na porcie 5435, migracje wykonują się przy pierwszym starcie

cd backend && npm install && npm run dev     # API na porcie 3100
cd frontend && npm install && npm run dev    # interfejs na porcie 5180
```

Migracje z `db/migrations/` wykonują się automatycznie przy tworzeniu bazy.
Na bazie już istniejącej uruchamia się je ręcznie:

```bash
for plik in db/migrations/*.sql; do
  docker exec -i sprawnik-db psql -U sprawnik -d sprawnik -v ON_ERROR_STOP=1 < "$plik"
done
```

System nie ma publicznej rejestracji — pierwsze konto zakłada się poleceniem,
a dane demonstracyjne (sprawy, pisma i wyznaczone z nich terminy) są opcjonalne:

```bash
cd backend
npm run konto -- adres@example.com haslo-o-osmiu-znakach "Imię Nazwisko" administrator
npm run demo  -- adres@example.com
```

## Testy

```bash
cd backend
docker exec sprawnik-db psql -U sprawnik -d postgres -c "CREATE DATABASE sprawnik_test"  # raz
npm test              # silnik terminów (bez bazy) oraz trasy API (na bazie testowej)
npm run test:silnik   # sam silnik — nie wymaga bazy
npm run test:api      # same trasy API
```

Testy tras API odtwarzają schemat bazy testowej z plików `db/migrations/`, więc
sprawdzają także kompletność migracji. Zabezpieczenie w kodzie nie pozwala ich
uruchomić na bazie, której nazwa nie kończy się na `_test`. Inny adres bazy
wskazuje się zmienną `TEST_DATABASE_URL`. Testy plików korzystają z osobnego,
tymczasowego katalogu w `/tmp`, niezależnie od magazynu dokumentów aplikacji.

## Dokumenty i konfiguracja

W widoku sprawy najpierw zarejestruj pismo, a następnie wybierz je w sekcji
„Dokumenty” i dołącz plik. Maksymalny rozmiar pliku wynosi 10 MiB. Wykaz można
przeszukiwać po nazwie dokumentu i filtrować według pisma. Pobranie pliku wymaga
zalogowania oraz dostępu do sprawy. Dokument pojawia się także w chronologii.

Pliki zapisywane są w `backend/uploads/`, jeżeli serwer uruchomiono z katalogu
`backend/`. Zmienna `UPLOAD_DIR` pozwala wskazać inny katalog. Baza przechowuje
metadane oraz SHA-256; przed pobraniem serwer sprawdza integralność pliku.
Kopia zapasowa powinna obejmować bazę i magazyn plików. Katalog magazynu nie
jest udostępniany jako publiczny katalog statyczny.

Administrator definiuje reguły w zakładce „Reguły”. W widoku sprawy użytkownik
może zmienić jej stan na „W toku”, „Zawieszona” lub „Zakończona”. Zakładanie
kont nadal odbywa się poleceniem `npm run konto`.

## Obieg korespondencji, skanowanie i OCR

Rejestr obejmuje wpływy, pisma wychodzące i odpowiedzi powiązane z wcześniejszym
pismem w tej samej sprawie. Można zapisać kanał i numer nadania oraz dołączyć
treść pisma, dowód nadania i potwierdzenie odbioru. Pismo wychodzące bez daty
nadania jest oznaczone jako przygotowywane. „Potwierdź nadanie” i potwierdzenie
doręczenia zapisują odrębne zdarzenia; aplikacja nie wysyła sama korespondencji.

W sekcji Dokumenty można wykonać zdjęcie aparatem urządzenia lub skan ze skanera
SANE. Fizyczny skaner obsługuje administrator, po włączeniu `SCANNER_ENABLED=true`.
Przycisk „Odczytaj tekst OCR” uruchamia lokalny Tesseract dla PNG, JPEG lub PDF.
Wynik można obejrzeć oraz przeszukiwać po zaznaczeniu odpowiedniego filtra.
Wymagane pakiety: `tesseract-ocr`, języki `pol` i `eng`, `poppler-utils`, `sane-utils`.

[Instrukcja obiegu, skanowania i OCR oraz rozróżnienie zakresu podstawowego i rozszerzeń](docs/07-obieg-skanowanie-ocr-2026-11-10.md).
OCR i skanowanie dodano na żądanie autora projektu; nie były warunkiem zaliczenia
w zachowanych ustaleniach z promotorem. Testy OCR i SANE wymagają tych narzędzi;
przy ich braku są oznaczone jako pominięte, również w CI.

Dla istniejącej bazy nowy etap wymaga wyłącznie migracji 003:

```bash
docker exec -i sprawnik-db psql -U sprawnik -d sprawnik -v ON_ERROR_STOP=1 < db/migrations/003_obieg_i_ocr.sql
```

Te same kroki wykonuje GitHub Actions przy każdej zmianie w repozytorium —
razem z kontrolą typów i budową wersji produkcyjnej interfejsu.

Interfejs: [http://127.0.0.1:5180](http://127.0.0.1:5180). Stan samego API
i połączenia z bazą: `/api/health`.

| Składnik | Port |
|----------|------|
| Interfejs (Vite) | 5180 |
| API (Express) | 3100 |
| PostgreSQL | 5435 |

Porty odbiegają od domyślnych (5173, 3000, 5432), ponieważ domyślne bywają zajęte
w środowisku lokalnym.

## Dokumentacja

**Migawka dokumentacji etapu pierwszego:**
[dokumentacja-projektowa.pdf](docs/dokumentacja-projektowa.pdf) — otwiera się
wprost w przeglądarce GitHuba. Nie obejmuje jeszcze obsługi plików dodanej
10.11.2026. Bieżący opis implementacji znajduje się w źródłach Markdown poniżej;
przed przekazaniem końcowej dokumentacji należy ponownie złożyć DOCX i PDF.

Dokumentacja projektowa prowadzona jest zgodnie z szablonem uczelnianym.
Treść zapisano w plikach źródłowych Markdown, z których generowany jest
dokument końcowy — dzięki temu historia repozytorium pokazuje przebieg pracy
nad dokumentacją, czego plik binarny nie ujawnia.

| Sekcja | Plik | Stan |
|--------|------|------|
| 1. Podstawowe informacje | [01-podstawowe-informacje.md](docs/dokumentacja/01-podstawowe-informacje.md) | gotowe |
| 2.1. Przypadki użycia | [02-kluczowe-zagadnienia.md](docs/dokumentacja/02-kluczowe-zagadnienia.md) | gotowe |
| 2.2. Model danych | [02-kluczowe-zagadnienia.md](docs/dokumentacja/02-kluczowe-zagadnienia.md) | gotowe |
| 2.3. Architektura | [02-kluczowe-zagadnienia.md](docs/dokumentacja/02-kluczowe-zagadnienia.md) | gotowe |
| 2.4. Fragmenty implementacji | [02-kluczowe-zagadnienia.md](docs/dokumentacja/02-kluczowe-zagadnienia.md) | gotowe |
| 3. Zrzuty ekranu | [03-zrzuty-ekranu.md](docs/dokumentacja/03-zrzuty-ekranu.md) | gotowe |
| 4. Wnioski | [04-wnioski.md](docs/dokumentacja/04-wnioski.md) | gotowe |
| 5. Bibliografia | [05-bibliografia.md](docs/dokumentacja/05-bibliografia.md) | gotowe |

### Diagramy

Każdy diagram ma w repozytorium źródło tekstowe obok obrazu, więc jego zmiany
są czytelne w historii zmian.

| Diagram | Obraz | Źródło |
|---------|-------|--------|
| Przypadki użycia (UML) | [przypadki-uzycia.png](docs/diagramy/przypadki-uzycia.png) | [.puml](docs/diagramy/przypadki-uzycia.puml) |
| Model danych (ERD) | [model-danych.png](docs/diagramy/model-danych.png) | [.puml](docs/diagramy/model-danych.puml) |
| Architektura (komponenty) | [architektura.png](docs/diagramy/architektura.png) | [.puml](docs/diagramy/architektura.puml) |

### Złożenie dokumentu

```bash
bash tools/build-dokumentacja.sh     # → build/dokumentacja-projektowa.docx
```

Materiał źródłowy poprzedzający dokumentację: [cel i założenia systemu](docs/01-cel-i-zalozenia.md).

## Stan implementacji

[Weryfikacja ośmiu funkcji i wyniki testów z 10.11.2026](docs/06-weryfikacja-zakresu-2026-11-10.md).

| Funkcja | Stan |
|---------|------|
| F1. Rejestracja i obsługa spraw | zaimplementowana |
| F2. Korespondencja przychodząca i wychodząca | zaimplementowana |
| F3. Dołączanie dokumentów | przesyłanie i pobieranie plików, metadane i SHA-256; dostęp przez pismo i sprawę |
| F4. Reguły terminów i ich wyznaczanie | zaimplementowana, pokryta testami |
| F5. Prezentacja terminów i ostrzeganie | zaimplementowana |
| F6. Wyszukiwanie i filtrowanie spraw oraz dokumentów | sprawy po tytule, znaku i organie; dokumenty po nazwie i piśmie |
| F7. Chronologia sprawy | zaimplementowana |
| F8. Uwierzytelnianie i uprawnienia | zaimplementowane; zakładanie kont poleceniem, bez panelu |

Struktura katalogów odpowiada warstwom z diagramu komponentów:

| Katalog | Warstwa |
|---------|---------|
| `frontend/src/` | warstwa frontendowa |
| `backend/src/routes/` | API — trasy REST |
| `backend/src/middleware/` | uwierzytelnianie, obsługa błędów |
| `backend/src/services/` | warstwa dziedzinowa, w tym silnik terminów |
| `backend/src/db/` | dostęp do danych |
| `db/migrations/` | schemat bazy i dane konfiguracyjne |

## Charakter projektu

System demonstracyjny i inżynierski. Nie odwzorowuje kompletnych procedur administracyjnych —
reguły wyznaczania terminów są konfigurowalne, a w projekcie przygotowano reprezentatywny zestaw
przykładów pokazujących działanie mechanizmu.

### Skany wysyłane z panelu urządzenia

Zakładka **Skany** (administrator) odbiera pliki z podkatalogów `epson/` i `kyocera/`, uruchamia lokalny OCR i proponuje własne sprawy po znakach spraw lub wcześniejszych pism. Przypisanie do pisma wymaga potwierdzenia; po imporcie oryginał trafia do osobnego archiwum. [Konfiguracja, zasady dopasowania i ograniczenia](docs/08-skrzynka-skanow-i-dopasowanie.md).
