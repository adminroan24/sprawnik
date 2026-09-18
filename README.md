# Sprawnik

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
docker compose up -d db       # PostgreSQL na porcie 5435

cd backend && npm install && npm run dev     # API na porcie 3100
cd frontend && npm install && npm run dev    # interfejs na porcie 5180
```

Sprawdzenie stanu systemu: [http://127.0.0.1:5180](http://127.0.0.1:5180) —
strona startowa odpytuje `/api/health` i pokazuje stan API oraz połączenia z bazą.

| Składnik | Port |
|----------|------|
| Interfejs (Vite) | 5180 |
| API (Express) | 3100 |
| PostgreSQL | 5435 |

Porty odbiegają od domyślnych (5173, 3000, 5432), ponieważ domyślne bywają zajęte
w środowisku lokalnym.

## Dokumentacja

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
| 2.4. Fragmenty implementacji | [02-kluczowe-zagadnienia.md](docs/dokumentacja/02-kluczowe-zagadnienia.md) | w trakcie |
| 3. Zrzuty ekranu | [03-zrzuty-ekranu.md](docs/dokumentacja/03-zrzuty-ekranu.md) | po ukończeniu interfejsu |
| 4. Wnioski | [04-wnioski.md](docs/dokumentacja/04-wnioski.md) | na zakończenie etapu |
| 5. Bibliografia | [05-bibliografia.md](docs/dokumentacja/05-bibliografia.md) | uzupełniana na bieżąco |

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

## Charakter projektu

System demonstracyjny i inżynierski. Nie odwzorowuje kompletnych procedur administracyjnych —
reguły wyznaczania terminów są konfigurowalne, a w projekcie przygotowano reprezentatywny zestaw
przykładów pokazujących działanie mechanizmu.
