# Dokumentacja projektowa — pliki źródłowe

Dokumentacja prowadzona jest zgodnie z szablonem uczelnianym. Treść zapisano
w plikach Markdown odpowiadających sekcjom szablonu, a dokument końcowy
w formacie `.docx` powstaje z nich poleceniem:

```bash
bash tools/build-dokumentacja.sh
```

Powodem takiego rozwiązania jest czytelność historii pracy. Plik `.docx` jest
binarny — w repozytorium każda jego wersja wygląda jak zupełnie nowy plik,
bez możliwości porównania zmian. Pliki źródłowe pokazują dokładnie, co i kiedy
zostało dopisane lub poprawione.

## Układ plików

| Plik | Sekcja szablonu | Limit stron |
|------|-----------------|-------------|
| `00-strona-tytulowa.md` | strona tytułowa | — |
| `01-podstawowe-informacje.md` | 1. Podstawowe informacje | 4 |
| `02-kluczowe-zagadnienia.md` | 2. Kluczowe zagadnienia związane z realizacją projektu | 3–5 |
| `03-zrzuty-ekranu.md` | 3. Zrzuty ekranu, wizualizacje | 5, opcjonalna |
| `04-wnioski.md` | 4. Wnioski i perspektywy rozwoju | 1 |
| `05-bibliografia.md` | 5. Bibliografia/źródła | — |

## Uwaga do pliku strony tytułowej

`00-strona-tytulowa.md` zawiera blok składu w formacie OOXML — czyli wewnętrznym
formacie dokumentów Word. Na GitHubie wyświetla się jako kod i tak ma być.

Powód: strona tytułowa szablonu ma ściśle określony układ, którego nie da się
wyrazić w Markdownie — krój Times New Roman, wcięcie akapitów 284 twips, odstęp
200 po akapicie, puste akapity budujące odstępy pionowe oraz blok z nazwiskiem
promotora wcięty o 4956 twips. Zapis bezpośrednio w OOXML pozwala odwzorować
szablon akapit po akapicie, zamiast przybliżać jego wygląd.

Strona tytułowa w postaci czytelnej:

> **KIERUNEK: INFORMATYKA**
>
> Roland Piątkowski
> studia niestacjonarne
> nr albumu 46653
>
> **Projekt i implementacja systemu wspomagania zarządzania korespondencją
> i terminami w postępowaniach administracyjnych**
>
> Dokumentacja do projektu dyplomowego
> przygotowana pod kierunkiem
> dra Marcina Kacprowicza
>
> Warszawa, 2026

Logo `logo-uczelni.png` pochodzi wprost z pliku szablonu i jest z nim zgodne
co do zawartości.

## Diagramy

Diagramy osadzone w dokumentacji znajdują się w katalogu [`../diagramy/`](../diagramy/).
Każdy ma obok obrazu źródło tekstowe `.puml`, z którego jest generowany.
