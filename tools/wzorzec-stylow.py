#!/usr/bin/env python3
"""Buduje wzorzec stylów dla pandoca, zgodny z wyglądem szablonu uczelnianego.

Szablon uczelniany użyty wprost jako --reference-doc powoduje, że tabele
przestają się renderować — komórki rozsypują się na osobne akapity. Zamiast
tego bierzemy sprawny wzorzec domyślny pandoca i przenosimy do niego cechy
wyglądu odczytane z szablonu: krój i stopień pisma, wygląd nagłówków oraz
format strony.

Wartości pochodzą z pliku szablonu:
  tekst podstawowy  Calibri, 12 pkt        (docDefaults, w:sz 24)
  nagłówki          Calibri Light, 2F5496  (styl Nagwek1, w:sz 32)
  strona            A4, marginesy 2,5 cm   (sectPr: 11900x16840, 1417 twips)
"""
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

TEKST_CZCIONKA = 'Calibri'
NAGLOWEK_CZCIONKA = 'Calibri Light'
NAGLOWEK_KOLOR = '2F5496'
TEKST_SZ = '24'          # połowy punktu → 12 pkt
NAGLOWKI_SZ = {'Heading1': '32', 'Heading2': '26', 'Heading3': '24'}

SECT_PR = (
    '<w:sectPr>'
    '<w:pgSz w:w="11900" w:h="16840"/>'
    '<w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" '
    'w:header="708" w:footer="708" w:gutter="0"/>'
    '<w:cols w:space="708"/>'
    '</w:sectPr>'
)


def wzorzec_domyslny(cel: Path) -> None:
    dane = subprocess.run(
        ['pandoc', '--print-default-data-file', 'reference.docx'],
        capture_output=True, check=True).stdout
    cel.write_bytes(dane)


def ustaw_czcionke_podstawowa(style: str) -> str:
    """Podmienia krój i stopień pisma w domyślnych ustawieniach dokumentu."""
    def zamien(m):
        blok = m.group(0)
        blok = re.sub(r'<w:rFonts[^/]*/>',
                      f'<w:rFonts w:ascii="{TEKST_CZCIONKA}" w:hAnsi="{TEKST_CZCIONKA}" '
                      f'w:eastAsia="{TEKST_CZCIONKA}" w:cs="{TEKST_CZCIONKA}"/>', blok, count=1)
        blok = re.sub(r'<w:sz w:val="\d+"/>', f'<w:sz w:val="{TEKST_SZ}"/>', blok)
        blok = re.sub(r'<w:szCs w:val="\d+"/>', f'<w:szCs w:val="{TEKST_SZ}"/>', blok)
        return blok
    return re.sub(r'<w:docDefaults>.*?</w:docDefaults>', zamien, style, flags=re.S)


def ustaw_naglowki(style: str) -> str:
    """Nadaje nagłówkom krój, kolor i stopień pisma z szablonu."""
    for styl_id, sz in NAGLOWKI_SZ.items():
        wzor = rf'(<w:style [^>]*w:styleId="{styl_id}".*?</w:style>)'
        m = re.search(wzor, style, re.S)
        if not m:
            continue
        blok = m.group(1)
        nowe_rpr = (
            f'<w:rPr><w:rFonts w:ascii="{NAGLOWEK_CZCIONKA}" w:hAnsi="{NAGLOWEK_CZCIONKA}" '
            f'w:eastAsia="{NAGLOWEK_CZCIONKA}" w:cs="{NAGLOWEK_CZCIONKA}"/>'
            f'<w:color w:val="{NAGLOWEK_KOLOR}"/>'
            f'<w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/></w:rPr>'
        )
        if '<w:rPr>' in blok:
            blok_nowy = re.sub(r'<w:rPr>.*?</w:rPr>', nowe_rpr, blok, count=1, flags=re.S)
        else:
            blok_nowy = blok.replace('</w:style>', nowe_rpr + '</w:style>')
        style = style.replace(blok, blok_nowy)
    return style


STYLE_TYTULOWE = (
    # Akapity strony tytułowej: wyśrodkowane, zgodnie z układem szablonu.
    '<w:style w:type="paragraph" w:styleId="TytulSrodek">'
    '<w:name w:val="TytulSrodek"/><w:basedOn w:val="Normal"/><w:qFormat/>'
    '<w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120"/></w:pPr>'
    '</w:style>'
    # Akapit z logo: wyśrodkowany, z wcięciem i odstępem jak w szablonie.
    '<w:style w:type="paragraph" w:styleId="TytulLogo">'
    '<w:name w:val="TytulLogo"/><w:basedOn w:val="Normal"/><w:qFormat/>'
    '<w:pPr><w:spacing w:before="0" w:after="200"/><w:ind w:left="284"/>'
    '<w:jc w:val="center"/></w:pPr>'
    '</w:style>'
    '<w:style w:type="paragraph" w:styleId="TytulSrodekMocny">'
    '<w:name w:val="TytulSrodekMocny"/><w:basedOn w:val="Normal"/><w:qFormat/>'
    '<w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="240"/></w:pPr>'
    f'<w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>'
    '</w:style>'
)


def dodaj_style_tytulowe(style: str) -> str:
    """Dokłada style strony tytułowej, jeśli jeszcze ich nie ma."""
    if 'w:styleId="TytulSrodek"' in style:
        return style
    return style.replace('</w:styles>', STYLE_TYTULOWE + '</w:styles>')


def ustaw_format_strony(dokument: str) -> str:
    if '<w:sectPr' in dokument:
        return re.sub(r'<w:sectPr.*?</w:sectPr>', SECT_PR, dokument, flags=re.S)
    return dokument.replace('</w:body>', SECT_PR + '</w:body>')


def zbuduj(cel: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        baza = Path(tmp) / 'baza.docx'
        wzorzec_domyslny(baza)
        with zipfile.ZipFile(baza) as z:
            pliki = {n: z.read(n) for n in z.namelist()}

        style = pliki['word/styles.xml'].decode('utf-8')
        style = ustaw_czcionke_podstawowa(style)
        style = ustaw_naglowki(style)
        style = dodaj_style_tytulowe(style)
        pliki['word/styles.xml'] = style.encode('utf-8')

        dokument = pliki['word/document.xml'].decode('utf-8')
        pliki['word/document.xml'] = ustaw_format_strony(dokument).encode('utf-8')

        cel.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(cel, 'w', zipfile.ZIP_DEFLATED) as z:
            for nazwa, dane in pliki.items():
                z.writestr(nazwa, dane)


if __name__ == '__main__':
    wynik = Path(sys.argv[1] if len(sys.argv) > 1 else 'build/wzorzec-stylow.docx')
    zbuduj(wynik)
    print(f'wzorzec stylów: {wynik}')
