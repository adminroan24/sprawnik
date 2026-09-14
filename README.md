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

```bash
docker compose up
```

## Dokumentacja

- [Cel i założenia](docs/01-cel-i-zalozenia.md)
- Przypadki użycia — w przygotowaniu
- Model danych — w przygotowaniu
- Architektura — w przygotowaniu

## Charakter projektu

System demonstracyjny i inżynierski. Nie odwzorowuje kompletnych procedur administracyjnych —
reguły wyznaczania terminów są konfigurowalne, a w projekcie przygotowano reprezentatywny zestaw
przykładów pokazujących działanie mechanizmu.
