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

### Zapis daty przed wyborem sprawy — kolejna aktualizacja 10.11.2026

Przycisk **Zapisz** obok daty wpływu zapisuje datę od razu przy skanie, bez wyboru sprawy, pisma ani uruchamiania OCR. Potwierdzenie „Zapisano datę wpływu” pojawia się dopiero po odpowiedzi serwera. Po zmianie daty interfejs prosi o ponowny zapis. Lista skanów ma kolumnę **Data wpływu**; ponowny wybór skanu wczytuje zapisaną datę również po odświeżeniu strony.

`PATCH /api/skany/:id/wplyw` jest dostępny administratorowi. Metadane daty zapisują się atomowo w `SCAN_ARCHIVE_DIR/metadane-skanow/`, poza udziałem skanerów, z prawami 0600. Rekord zawiera datę, identyfikator zapisującego, czas zapisu, SHA-256 oraz identyfikację wersji pliku (inode, rozmiar, mtime i ctime). Podmieniony lub ponownie zapisany plik o tej samej nazwie nie dziedziczy wcześniejszej daty. Metadane muszą być uwzględnione w kopii zapasowej razem z archiwum; nie należy ich edytować ręcznie. Data zachowana jest również w metryce importu lub kosza.

Zapis daty przy skanie nie tworzy sam terminu ani doręczenia w nieistniejącym piśmie. Późniejsze przypisanie do pisma korzysta z zapisanej daty; termin zależy od wybranej reguły, zgodnie z poprzednią sekcją.

## Termin odpowiedzi / wykonania — aktualizacja 10.11.2026

Przy skanie dostępna jest osobna sekcja **Termin odpowiedzi / wykonania**. Po zapisaniu daty wpływu można ustawić termin, nie wybierając sprawy. **Odczytaj wezwanie i termin** uruchamia lokalny OCR oraz wyodrębnianie propozycji z rozpoznanego tekstu. Propozycja zawiera cytowany fragment źródłowy. Obsługiwane są typowe sformułowania „w terminie N dni”, „w ciągu N dni”, dni robocze, część zapisów słownych i konkretne daty po „do dnia” (ISO albo DD.MM.RRRR, także z separatorami / i -). Pouczenie o odwołaniu lub zażaleniu nie jest traktowane jako termin odpowiedzi. Przy kilku terminach trzeba wskazać właściwy. Błędny OCR, nietypowa konstrukcja lub data zapisana słownie mogą wymagać wpisania ręcznego.

**Użyj propozycji** wypełnia edytor. Bez odczytu również można wybrać **Liczba dni** lub **Konkretna data**, wpisać wartość, a następnie nacisnąć **Pokaż termin odpowiedzi**. Dni mogą być liczone od zapisanej daty wpływu albo innej daty wskazanej ręcznie. Brak jednoznacznego „od doręczenia/otrzymania” w odczycie wymaga uzupełnienia innej daty. Przesunięcie końca z dnia wolnego jest osobną, początkowo wyłączoną opcją; nie jest domniemywaną zasadą dla każdego dokumentu. Konkretna data z pisma pozostaje bez przesunięcia. Po sprawdzeniu wyniku i zaznaczeniu potwierdzenia przycisk **Zapisz termin odpowiedzi** utrwala go w metadanych skanu oraz pokazuje w kolumnie na liście. OCR sam nie zatwierdza terminu.

Termin wcześniejszy niż data wpływu jest pokazywany bez zmiany daty, z ostrzeżeniem. Nie zastępujemy takiej daty automatycznie datą wpływu ani inną liczbą dni. Zmiana zapisanej daty wpływu przelicza zatwierdzony termin wyrażony liczbą dni od wpływu; nie zmienia konkretnej daty lub osobno wskazanej daty początkowej.

Przy imporcie **treści pisma przychodzącego** zatwierdzony termin trafia do tego pisma i sprawy, a następnie jest widoczny w przeglądzie terminów. Data doręczenia pisma musi odpowiadać dacie wpływu skanu. W bazie jest oznaczony jako ręczny, ponieważ wybór i zatwierdzenie nastąpiły przez użytkownika, bez przypisania gotowej reguły. Dla konkretnej daty zapis stanowi zdarzenie jednodniowe (początek równy końcowi); data doręczenia pozostaje oddzielnie w piśmie. Ponowienie importu tego samego terminu do pisma nie tworzy duplikatu. Inny istniejący termin odpowiedzi zgłasza konflikt; aplikacja go nie nadpisuje. Jeśli dokument zapisano przed błędem zapisu terminu, oryginalny skan pozostaje w poczekalni, a ponowienie korzysta z tego samego dokumentu.

API: `POST /api/skany/:id/termin-odpowiedzi/podglad` oraz `PATCH /api/skany/:id/termin-odpowiedzi` z jawnym `potwierdzono: true`. Weryfikacja: **69 testów poprawnych** (31 silnika/dopasowania/parsera, 38 API), typecheck obu warstw, build oraz sprawdzenie w przeglądarce na syntetycznym wezwaniu: lokalny OCR → propozycja daty, ręczne dni → podgląd → potwierdzenie → zapis i ostrzeżenie dla daty sprzed wpływu. Rzeczywistego wezwania nie modyfikowano podczas testów.
