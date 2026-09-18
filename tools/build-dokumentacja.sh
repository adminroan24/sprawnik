#!/usr/bin/env bash
# Generuje dokumentację projektową w formacie .docx z plików źródłowych Markdown.
#
# Dlaczego Markdown, skoro oddajemy .docx:
# promotor wymaga, aby repozytorium pokazywało przebieg pracy. Plik .docx jest
# binarny i w historii gita nie ujawnia żadnych różnic. Treść prowadzona jest
# więc w Markdownie, a dokument oddawany promotorowi powstaje z tych źródeł.
#
# Wygląd dokumentu:
# szablon uczelniany użyty wprost jako --reference-doc rozsypuje tabele, dlatego
# wzorzec stylów budowany jest osobno (tools/wzorzec-stylow.py): sprawny wzorzec
# pandoca z przeniesionymi cechami wyglądu szablonu — Calibri 12 pkt, nagłówki
# Calibri Light w kolorze 2F5496, A4 z marginesami 2,5 cm.
# Układ sekcji dokumentu odpowiada sekcjom szablonu 1:1.
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
# Wzorzec stylów zgodny z wyglądem szablonu uczelnianego.
WZORZEC="$KATALOG/build/wzorzec-stylow.docx"
python3 "$KATALOG/tools/wzorzec-stylow.py" "$WZORZEC" >/dev/null

# Szablon nie przewiduje spisu treści, a strona tytułowa ma być pierwsza.
pandoc -M lang=pl --reference-doc="$WZORZEC" \
  00-strona-tytulowa.md \
  01-podstawowe-informacje.md \
  02-kluczowe-zagadnienia.md \
  03-zrzuty-ekranu.md \
  04-wnioski.md \
  05-bibliografia.md \
  -o "$WYNIK"

echo "gotowe: $WYNIK"
