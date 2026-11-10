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

## Data wpływu i usuwanie skanu — aktualizacja 10.11.2026

Przy wybranym skanie znajduje się pole **Data wpływu / doręczenia** oraz przycisk **Dzisiaj**, ustawiający lokalny dzień użytkownika. Pole początkowo jest puste: OCR, data pliku i data skanowania go nie wypełniają. Dla roli „Treść pisma” i kierunku przychodzącego data jest wymagana zarówno w interfejsie, jak i przy imporcie przez API.

Przy rejestracji nowego pisma data z sekcji skanu trafia do `dataDoreczenia`. Regułę terminu wybiera się w formularzu pisma. Przy wskazaniu istniejącego pisma bez doręczenia można uzupełnić tę samą datę i regułę od doręczenia bezpośrednio w kroku importu. Najpierw zapisywane są data i ewentualny termin, następnie dokument. Jeśli import pliku się nie powiedzie, zapisane doręczenie pozostaje w piśmie i jest pokazywane w interfejsie; ponowienie nie nadpisuje daty ani nie tworzy ponownie terminu. Dla pisma z zapisaną datą pole jest tylko do odczytu. Brak wybranej reguły oznacza brak automatycznie wyznaczonego terminu — interfejs o tym informuje. Nie wolno traktować daty na treści pisma jako potwierdzenia jego rzeczywistego doręczenia.

Przycisk **Usuń skan** przy pliku otwiera potwierdzenie z opcjonalnym powodem. Potwierdzenie wywołuje `POST /api/skany/:id/kosz` (administrator). Plik znika z poczekalni i trafia do `SCAN_ARCHIVE_DIR/kosz/<uuid>/` wraz z metryką, bez trwałego kasowania. Nie zmienia dokumentów już zapisanych w sprawach. Plik można odzyskać ręcznie z kosza do właściwego katalogu urządzenia; nie ma jeszcze przycisku przywracania w aplikacji. Plik w trakcie odbioru i dowiązania są odrzucane, a import i usunięcie tego samego skanu wzajemnie się blokują. Można usunąć do kosza również plik przekraczający limit importu.

Weryfikacja aktualizacji: 24 testy silnika/dopasowania i 34 API (58 poprawnych, bez pominięć), typecheck obu warstw i build interfejsu. Testy obejmują zachowanie daty 06.11.2026 i terminu według fikcyjnej reguły po późniejszym imporcie, blokadę importu treści bez daty oraz kosz, zachowanie oryginału i istniejących dokumentów. Fikcyjna reguła testowa nie określa terminu żadnego rzeczywistego wezwania.
