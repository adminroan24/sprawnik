# Profil firmy i drzewo spraw

Stan implementacji: 10.11.2026. Rozszerzenie dodane na polecenie autora, niezależne od pierwotnego zakresu F1–F8. Nie zmienia tematu projektu ani nie oznacza osobnej akceptacji tego rozszerzenia przez promotora. Projekt nadal demonstruje zarządzanie sprawami, dokumentami i terminami.

## Działanie

Instalacja ma jeden profil organizacji. Zalogowani użytkownicy widzą jej nazwę i mogą odczytać profil; tylko administrator edytuje go w zakładce **Firma i drzewo**. Pola: nazwa, identyfikator podatkowy, e-mail, telefon, adres, strona WWW. Przyciskiem **Zapisz firmę** zatwierdza się zmiany.

Administrator dodaje i edytuje grupy oraz podgrupy: nazwę, rodzica i kolejność. Wskazanie innego rodzica przenosi całą gałąź, zachowując identyfikatory. Dwie grupy pod tym samym rodzicem nie mogą mieć tej samej nazwy bez względu na wielkość liter. Nie można przenieść grupy pod nią samą lub jej potomka; operacje zmiany drzewa są serializowane blokadą transakcyjną PostgreSQL. Usuwanie wymaga potwierdzenia i jest możliwe tylko dla pustej grupy. Grupy zawierające sprawy dowolnego właściciela albo podgrupy są chronione.

W **Sprawach** dostępne jest drzewo. Wybrana grupa obejmuje także sprawy w podgrupach. Widoki **Bez przypisanej grupy** oraz **Archiwum — zakończone sprawy** są filtrami. Administrator ma tu również przejście do skanów oczekujących. Nowa sprawa może otrzymać grupę podczas rejestracji; istniejącą przenosi się polem **Grupa sprawy** i przyciskiem **Zapisz grupę sprawy**. Numery spraw, korespondencja, dokumenty i terminy są zachowane.

Grupy są wspólną klasyfikacją organizacji. Własność i widoczność spraw nadal wynikają z zalogowanego użytkownika. Administrator zarządzający drzewem nie otrzymuje w ten sposób dostępu do cudzych spraw. Rozszerzenie nie wprowadza obsługi wielu firm w jednej instalacji ani współdzielenia spraw zespołu.

To drzewo logiczne w bazie i interfejsie. Dokument pozostaje przypisany do pisma i sprawy, a plik pozostaje w magazynie z losową nazwą i kontrolą SHA-256. Zmiana grupy nie przenosi fizycznych plików na dysku. Eksport akt do katalogów oraz automatyczne numery w formacie firmowym nie są częścią tej zmiany.

## Szablon CreationX

Przycisk **Utwórz drzewo CreationX** jest dostępny przy pustym drzewie. Dodaje 11 grup:

```text
Sprawy własne firmy
├── Urzędy
│   ├── Urząd Skarbowy
│   └── ZUS
├── Księgowość i rozliczenia
├── Banki, leasing i finansowanie
├── Dostawcy i umowy
├── Biuro i administracja
└── Spory i reklamacje
Klienci
Przetargi i postępowania ofertowe
```

Pod grupą Klienci administrator może dodawać firmy/domeny i dalsze podgrupy. Szablon nie tworzy klientów ani spraw i nie daje się ponownie zastosować do niepustego drzewa. Migracja pozostawia dotychczasowe sprawy bez grupy. Ich klasyfikację wybiera użytkownik.

## Baza i uruchomienie

Migracja `004_firma_i_grupy.sql` dodaje tabele `profil_firmy`, `grupa_spraw` oraz opcjonalny klucz `sprawa.grupa_id`. Nowa baza inicjalizowana przez Docker wykona migracje po kolei. Dla istniejącej bazy, po utworzeniu kopii zapasowej:

```bash
docker exec -i sprawnik-db psql -U sprawnik -d sprawnik -v ON_ERROR_STOP=1 < db/migrations/004_firma_i_grupy.sql
```

Następnie uruchomić nową wersję API. Domyślny profil nazywa się „Organizacja”; ustawienie rzeczywistej firmy wykonuje administrator. Danych kontaktowych rzeczywistych firm nie zaszyto w migracji. Źródłem danych dziedzinowych jest PostgreSQL 17, pliki dokumentów pozostają na dysku. Przed użyciem migracji na istniejącej bazie należy upewnić się, że nie została już wykonana.

API: `GET/PATCH /api/firma`, `GET/POST /api/grupy`, `PATCH/DELETE /api/grupy/:id`, `POST /api/grupy/szablon-creationx`; filtry `/api/sprawy?grupaId=...` i `?nieprzypisane=true`. Pole `grupaId` jest obsługiwane przy tworzeniu i aktualizacji sprawy.

## Weryfikacja

74 testy lokalne poprawne (31 silnika/parsera/dopasowania, 43 API), bez pominięć; typecheck obu warstw i build poprawne. Nowe testy obejmują uprawnienia, profil i walidację adresów, unikalność grup, pętle również przy równoczesnych przeniesieniach, filtrowanie potomków, izolację właścicieli, zachowanie pliku i terminu po przeniesieniu sprawy, ochronę niepustych grup i szablon.

W przeglądarce na odizolowanych danych sprawdzono zapis firmy z aktualizacją nazwy w nagłówku, dodanie podgrupy klienta, przypisanie istniejącej sprawy i prezentację w drzewie. ERD, diagram komponentów i przypadków użycia zaktualizowano, wyrenderowano i obejrzano. Historyczny PDF dokumentacji nie jest automatycznie aktualizowany przez tę zmianę.
