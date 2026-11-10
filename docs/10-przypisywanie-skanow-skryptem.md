# Przypisywanie skanu skryptem

Stan: 10.11.2026. Polecenie korzysta z istniejącego API i tych samych uprawnień co zakładka Skany. Wymaga konta administratora, dostępu do własnej sprawy i działającej skrzynki skanów. Nie łączy się bezpośrednio z bazą.

## Przygotowanie

Po zalogowaniu przez `POST /api/logowanie` zapisz zwrócony token w prywatnym pliku sesji poza repozytorium. Przykładowa zawartość (adres API dostosuj do uruchomienia):

```json
{"api":"http://127.0.0.1:33119/api","token":"TOKEN_Z_LOGOWANIA"}
```

Nadaj plikowi prawa `chmod 600 /prywatny/sesja.json`. Skrypt odrzuca plik czytelny dla grupy lub innych użytkowników. Zdalne API wymaga HTTPS; lokalnie dopuszczony jest HTTP. Token wygasa zgodnie z konfiguracją logowania. Po wygaśnięciu trzeba ponownie się zalogować i uaktualnić sesję.

Identyfikator skanu pochodzi z `GET /api/skany`, a SHA-256 z `POST /api/skany/:id/rozpoznaj`. Datę wpływu zapisz wcześniej w interfejsie lub przez `PATCH /api/skany/:id/wplyw`. Sprawdź dane na oryginale.

Plan nowej sprawy i nowego pisma (dane przykładowe; identyfikator, suma oraz grupa wymagają zastąpienia):

```json
{
  "skanId": "IDENTYFIKATOR_Z_LISTY_SKANOW",
  "sha256": "64_ZNAKI_HEKSADECYMALNE_Z_ODCZYTU_OCR",
  "nowaSprawa": {"tytul": "Sprawa przykładowa", "grupaId": 9},
  "nowePismo": {"rodzaj": "Wezwanie", "korespondent": "Nadawca przykładowy", "znakPisma": "TEST/2026/123"},
  "rola": "tresc"
}
```

Dla istniejącej sprawy zamiast `nowaSprawa` podaj `"sprawaId": 123`. Dla istniejącego pisma zamiast `nowePismo` podaj `"pismoId": 456` oraz jego `sprawaId`. Nowe pismo jest zawsze przychodzące. Dostępne role to `tresc`, `zalacznik`, `dowod_nadania`, `potwierdzenie_odbioru`. Bez grupy można podać `grupaId: null`. Identyfikatory grup odczytasz przez `GET /api/grupy`.

## Podgląd i zapis

Z katalogu `backend/`:

```bash
npm run przypisz-skan -- --sesja /prywatny/sesja.json --plan /prywatny/plan.json
```

Domyślnie skrypt sprawdza plik, odczytuje OCR i pokazuje plan. Nie tworzy sprawy, pisma ani dokumentu. Dopiero dodanie `--zapisz` wykonuje przypisanie:

```bash
npm run przypisz-skan -- --sesja /prywatny/sesja.json --plan /prywatny/plan.json --zapisz
```

Dla treści przychodzącej wymagana jest data wpływu. Rozbieżność między zapisaną datą skanu a doręczeniem istniejącego pisma zatrzymuje wykonanie. Zmiana zawartości pliku względem sumy w planie również je zatrzymuje. Propozycje terminów z OCR są wyłącznie pokazywane. Skrypt ich nie zatwierdza. Wcześniej zatwierdzony termin skanu jest przenoszony przez API przy imporcie treści pisma przychodzącego.

## Wznowienie i ograniczenia

Obok planu powstaje prywatny `plan.json.stan.json`: identyfikatory utworzonej sprawy, pisma i wynik importu. Ponowienie tego samego polecenia wykorzystuje zapisany stan; po ukończeniu zwraca wcześniejszy wynik. Nie usuwaj dziennika. Po rozpoczęciu zapisu nie zmieniaj planu. Plik `.lock` uniemożliwia jednoczesne wykonanie tego samego planu; po wymuszonym zatrzymaniu procesu usuń go dopiero po sprawdzeniu, że proces o zapisanym PID już nie pracuje.

Sekwencja nie jest jedną transakcją. Utrata odpowiedzi API lub przerwanie procesu między utworzeniem rekordu a zapisaniem dziennika może pozostawić sprawę lub pismo bez identyfikatora w dzienniku. W takiej sytuacji przed ponowieniem sprawdź aplikację i przygotuj plan z istniejącymi identyfikatorami. Blokada nie chroni przed równoległym importem przez interfejs ani przed wykonaniem osobnej kopii planu. Ostrzeżenie archiwizacji oznacza, że dokument zapisano, ale przeniesienie oryginału wymaga sprawdzenia.

Plany, sesje, dzienniki i wyniki zawierają dane prywatne. Przechowuj je poza publicznym repozytorium z ograniczonymi prawami dostępu.

## Weryfikacja

Przeszło 80 testów backendu (37 usług i 43 API), bez pominięć, oraz kontrola typów. Dodatkowo wykonano CLI na fikcyjnym skanie z osobnym API i bazą: podgląd bez zapisu, utworzenie sprawy i pisma, zachowanie daty wpływu, zapis OCR, zgodność pobranego pliku oraz ponowne wykonanie bez dodatkowych rekordów.
