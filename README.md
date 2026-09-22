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
cp .env.example .env          # uzupełnij wartości
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
wskazuje się zmienną `TEST_DATABASE_URL`.

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

**Złożony dokument do podglądu:**
[dokumentacja-projektowa.pdf](docs/dokumentacja-projektowa.pdf) — otwiera się
wprost w przeglądarce GitHuba. Wersją oddawaną jest plik `.docx` generowany
z tych samych źródeł.

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

| Funkcja | Stan |
|---------|------|
| F1. Rejestracja i obsługa spraw | zaimplementowana |
| F2. Korespondencja przychodząca i wychodząca | zaimplementowana |
| F3. Dołączanie dokumentów | model danych gotowy, obsługa plików w przygotowaniu |
| F4. Reguły terminów i ich wyznaczanie | zaimplementowana, pokryta testami |
| F5. Prezentacja terminów i ostrzeganie | zaimplementowana |
| F6. Wyszukiwanie i filtrowanie spraw | zaimplementowane |
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
