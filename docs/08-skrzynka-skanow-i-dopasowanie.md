# Skrzynka skanów i rozpoznawanie spraw

Stan implementacji: 10.11.2026. Rozszerzenie wykonane na prośbę autora projektu.

## Użycie

1. Administrator wskazuje katalog odbiorczy przez `SCAN_INBOX_DIR`. W nim tworzy podkatalogi `epson` i `kyocera`, zapisywane przez skanery.
2. W `SCAN_ARCHIVE_DIR` wskazuje osobny katalog archiwum, poza udziałem dostępnym skanerom. Oba katalogi powinny być na tym samym systemie plików, aby przenoszenie było atomowe.
3. W zakładce **Skany** odświeża listę, wybiera plik i uruchamia **Rozpoznaj tekst i sprawę**. Po zapisie ze skanera plik czeka co najmniej 10 sekund; limit wynosi 10 MiB. Obsługiwane rozszerzenia: PDF, PNG, JPG, JPEG; OCR sprawdza również zawartość pliku.
4. Lokalny Tesseract odczytuje tekst. Sprawnik porównuje go ze znakami spraw i wcześniejszych pism należących do zalogowanego użytkownika. Znaki krótsze niż sześć liter/cyfr są pomijane. Różnice wielkości liter, spacje i typowe separatory są tolerowane; błędnie odczytanych liter program nie zgaduje.
5. Jedno dopasowanie znaku wstępnie wybiera sprawę. Kilka zgodnych spraw wymaga ręcznego wyboru. Zbieżność nazwy instytucji daje jedynie słabą propozycję, bez automatycznego wyboru. To reguły dopasowania, bez statystycznej oceny prawdopodobieństwa i bez usług AI.
6. Użytkownik wybiera istniejące pismo albo rejestruje nowe, wskazuje rolę dokumentu i potwierdza import. Dane pisma i daty uzupełnia po sprawdzeniu oryginału. OCR nie wyznacza sam terminów.
7. Plik i suma SHA-256 trafiają do magazynu dokumentów, a wykonany OCR pozostaje dostępny w sprawie. Źródło jest przenoszone do archiwum pod losową nazwą; obok powstaje metryka JSON. Przy błędzie archiwizacji dokument pozostaje zapisany, oryginał nie jest usuwany, a interfejs pokazuje ostrzeżenie. Ponowny import identycznego pliku do tego samego pisma w tej samej roli wykorzystuje istniejący dokument.

## Konfiguracja

```dotenv
SCAN_INBOX_DIR=/srv/sprawnik/skany
SCAN_ARCHIVE_DIR=/srv/sprawnik/archiwum
```

Bez konfiguracji katalog odbiorczy nazywa się `skany`, obok katalogu magazynu dokumentów; domyślne archiwum to sąsiedni katalog `skany-archiwum`. Aplikacja nie konfiguruje udziałów SMB ani kont urządzeń. Dane dostępowe skanerów należy przechowywać poza repozytorium. Bezpośrednie skanowanie SANE jest niezależne od skrzynki.

Skrzynka jest wspólna dla urządzeń i dostępna wyłącznie administratorowi. Dopasowania oraz zapis do spraw nadal podlegają własności zalogowanego użytkownika. Konta z różnymi właścicielami nie widzą wzajemnie swoich spraw. Dowiązania symboliczne plików i podkatalogów urządzeń są odrzucane.

## Weryfikacja

24 testy silnika i dopasowania oraz 32 testy API przeszły lokalnie, bez pominięć. Nowe testy obejmują: zgodność znaku i poprzedniego pisma, niejednoznaczność, słabe dopasowanie instytucji, izolację właścicieli, odbiór obu źródeł, limit rozmiaru, dowiązania i ścieżki, plik w trakcie odbioru, kontrolę SHA-256, import z OCR, pobranie tych samych bajtów, archiwizację i powtórny import bez duplikatu.

Testy wykorzystują syntetyczny obraz i odizolowaną bazę `_test`. Nie potwierdzają fizycznego przesłania kartki z urządzenia. Test faktycznego skanowania wymaga przygotowanej kartki i działającego profilu urządzenia.

## Ograniczenia

Odczyt i import uruchamia się przyciskami; nie ma procesu działającego w tle, który sam przypisuje nowe pliki. Automatyczne zakładanie nowych spraw, odczyt dat z OCR i rozpoznawanie pisma odręcznego nie są zaimplementowane. Limity OCR pozostają takie jak dla dokumentów w sprawie: do 20 stron PDF, jeden proces OCR jednocześnie.
