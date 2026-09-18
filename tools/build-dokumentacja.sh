#!/usr/bin/env bash
# Generuje dokumentację projektową w formacie .docx z plików źródłowych Markdown.
#
# Dlaczego Markdown, skoro oddajemy .docx:
# promotor wymaga, aby repozytorium pokazywało przebieg pracy. Plik .docx jest
# binarny i w historii gita nie ujawnia żadnych różnic. Treść prowadzona jest
# więc w Markdownie, a dokument oddawany promotorowi powstaje z tych źródeł.
#
# Dlaczego bez --reference-doc:
# szablon uczelniany sprawdzono jako wzorzec stylów pandoca — powoduje, że
# tabele przestają się renderować (komórki rozsypują się na osobne akapity).
# Szablon traktujemy jako specyfikację treści: układ sekcji i limity stron.
# Struktura plików źródłowych odpowiada jego sekcjom 1:1.
set -euo pipefail

KATALOG="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZRODLA="$KATALOG/docs/dokumentacja"
WYNIK="$KATALOG/build/dokumentacja-projektowa.docx"
PLANTUML="${PLANTUML_JAR:-$HOME/.local/share/plantuml/plantuml.jar}"

# 1. Diagramy — w repozytorium wersjonowane są źródła .puml, obrazy powstają z nich.
if [[ -f "$PLANTUML" ]]; then
  for puml in "$KATALOG"/docs/diagramy/*.puml; do
    [[ -e "$puml" ]] || continue
    java -jar "$PLANTUML" -tpng -o . "$puml"
    echo "diagram: $(basename "${puml%.puml}").png"
  done
else
  echo "pominięto diagramy — brak $PLANTUML" >&2
fi

# 2. Dokument. Pandoc uruchamiany z katalogu źródeł, aby ścieżki do obrazów
#    (../diagramy/...) rozwiązywały się poprawnie.
mkdir -p "$KATALOG/build"
cd "$ZRODLA"
# Szablon nie przewiduje spisu treści, a strona tytułowa ma być pierwsza.
pandoc -M lang=pl \
  00-strona-tytulowa.md \
  01-podstawowe-informacje.md \
  02-kluczowe-zagadnienia.md \
  03-zrzuty-ekranu.md \
  04-wnioski.md \
  05-bibliografia.md \
  -o "$WYNIK"

echo "gotowe: $WYNIK"
