# Obieg korespondencji skanowanie i OCR

## Zakres uzgodniony z promotorem

We wrześniu 2026 r. uzgodniono osiem funkcji: obsługę spraw; rejestr korespondencji
przychodzącej i wychodzącej; dołączanie dokumentów; konfigurowalne reguły terminów;
prezentację terminów i ostrzeganie; wyszukiwanie i filtrowanie; chronologię;
uwierzytelnianie i podstawowe uprawnienia. System ma charakter demonstracyjny,
z reprezentatywnymi regułami, a nie kompletnym odwzorowaniem procedur.

Promotor wskazał wyszukiwanie w treści dokumentów, rozbudowane statystyki
i zaawansowany eksport akt jako zakres dodatkowy. W korespondencji nie ustalono
skanowania ze sprzętu ani OCR jako warunku zaliczenia. Dodano je na polecenie
autora projektu z 10.11.2026.

## Rejestracja całego obiegu pisma

1. Utwórz sprawę i zarejestruj pismo przychodzące: nadawcę, rodzaj, znak,
   datę nadania i znaną datę doręczenia. Opcjonalnie wskaż regułę terminu.
2. W sekcji Dokumenty wybierz pismo i rodzaj dokumentu: treść, załącznik,
   dowód nadania lub potwierdzenie odbioru. Dołącz plik, zdjęcie lub skan.
3. Przy piśmie wybierz „Zarejestruj odpowiedź”. Formularz zachowa powiązanie
   z tym pismem i zaproponuje przeciwny kierunek. Kierunek można zmienić,
   np. przy kolejnym piśmie we własnym wątku.
4. Wprowadź kanał: e-mail, e-Doręczenia, ePUAP, poczta, osobiście lub inny.
   Zapisz identyfikator przesyłki, jeśli jest dostępny. Pismo wychodzące bez
   daty nadania jest oznaczone jako przygotowywane.
5. Po rzeczywistym wysłaniu użyj „Potwierdź nadanie”, podając datę, kanał
   i numer przesyłki. Regułę od nadania można wskazać w tej operacji.
   Dowód nadania dołącz jako dokument o odpowiedniej roli.
6. Po otrzymaniu potwierdzenia odbioru uzupełnij datę doręczenia i dołącz dowód.
   Regułę od doręczenia wskazuje się przy tej dacie.
7. Odpowiedź adresata zapisz jako następne pismo przychodzące, powiązane
   z wysłanym. Dokumenty i terminy pozostają w tej samej sprawie.

Chronologia zachowuje odrębne zdarzenia nadania i doręczenia pisma wychodzącego.
Przygotowanie pisma bez daty nadania nie jest opisywane jako wysyłka. Powiązania
odpowiedzi są ograniczone do tej samej sprawy i jej właściciela.

System rejestruje dokonane czynności. Nie wysyła samodzielnie wiadomości ani
nie składa pism w e-Doręczeniach. Samo dołączenie dowodu nie uzupełnia daty:
daty nadania i doręczenia podaje użytkownik.

## Skaner i aparat

„Zrób zdjęcie dokumentu” korzysta z wejścia aparatu udostępnianego przez
przeglądarkę urządzenia. Na telefonie może otworzyć aparat, a na komputerze
wybór pliku. Przed dołączeniem zdjęcia wybiera się pismo i rolę dokumentu.
Nie ma automatycznego kadrowania ani korekcji perspektywy.

Administrator może odświeżyć listę skanerów SANE, wybrać urządzenie i 150, 200
lub 300 dpi, a następnie uruchomić skan kartki. Wynik PNG trafia do wybranego
pisma. Każde wywołanie zapisuje jedną stronę. Skaner musi być podłączony do
komputera serwera lub dostępny przez jego konfigurację SANE.

Włączenie obsługi sprzętu wymaga `SCANNER_ENABLED=true` i programu `scanimage`.
Przy wyłączonej funkcji API nie przeszukuje urządzeń. Samo uruchomienie aplikacji
nie wykonuje skanu. Karta testowa SANE jest używana wyłącznie w testach.

Podgląd na 127.0.0.1 jest dostępny na komputerze serwera. Korzystanie z aparatu
innego urządzenia wymaga osobno skonfigurowanego dostępu do aplikacji z tego
urządzenia. W ramach tej zmiany nie wystawiono aplikacji publicznie.

## OCR

Po dodaniu dokumentu użyj „Odczytaj tekst OCR”. Tesseract rozpoznaje tekst
lokalnie, w językach polskim i angielskim. Dokumenty nie są wysyłane do
zewnętrznego API. Obsługiwane są PNG, JPEG i PDF; PDF jest rasteryzowany
przez Poppler. Limit wejścia to 10 MiB i do 20 stron PDF. Odczytywany jest
jeden dokument naraz. Błąd OCR nie usuwa oryginalnego pliku.

Wynik jest zapisywany oddzielnie od skanu. „Pokaż tekst OCR” otwiera wynik,
a „Ponów OCR” ponawia odczyt. „Szukaj także w tekście OCR” rozszerza wyszukiwanie
o rozpoznaną treść. Jest to wyszukiwanie fragmentów tekstu, bez indeksu
lingwistycznego. Daty, kwoty i sygnatury trzeba sprawdzić z oryginałem;
OCR nie uzupełnia automatycznie danych pisma ani terminów.

Na Debianie/Ubuntu potrzebne są `tesseract-ocr`, `tesseract-ocr-pol`,
`tesseract-ocr-eng`, `poppler-utils` oraz `sane-utils`. W istniejącej bazie
wykonaj wyłącznie migrację `003_obieg_i_ocr.sql`, po wykonaniu kopii bazy.

## Sprawdzenia

Wykonano 19 testów silnika i 29 testów API, kontrolę typów oraz budowę interfejsu.
OCR sprawdzono rzeczywistymi programami na syntetycznych skanach PNG/PDF.
Skanowanie sprawdzono na oficjalnym backendzie testowym SANE, bez odczytywania
dokumentów z fizycznego urządzenia. Przy braku narzędzi OCR lub SANE odpowiednie
testy integracyjne są pomijane, co widać w wyniku testów.

Nie wykonano wizualnej kontroli formularzy ani fizycznego skanu kartki z urządzeń
użytkownika. PDF etapu pierwszego pozostaje oznaczoną historyczną migawką.
