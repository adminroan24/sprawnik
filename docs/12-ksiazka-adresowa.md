# Książka adresowa

Stan implementacji: 10.11.2026. Rozszerzenie rejestru korespondencji na prośbę autora projektu.

## Użycie

W zakładce **Książka adresowa** administrator dodaje, edytuje i usuwa nieużyte kontakty. Obsługiwane typy to osoba, firma i instytucja / urząd. Wpis zawiera nazwę, NIP, e-mail, telefon, adres pocztowy, osobę do kontaktu, adres e-Doręczeń, skrytkę ePUAP i uwagi wewnętrzne. Poza typem i nazwą pola są opcjonalne. NIP i adresy usług publicznych są zapisywane jako tekst, bez sprawdzenia w zewnętrznych rejestrach.

Książka jest wspólna dla jednej organizacji w tej instalacji. Zalogowani użytkownicy mogą ją przeglądać, wyszukiwać i wybierać kontakty w swoich pismach. Własność oraz dostęp do spraw pozostają bez zmian. Wpisów z istniejących prywatnych spraw nie przenosi się automatycznie do wspólnej książki.

W formularzu pisma przychodzącego lub wychodzącego wyszukaj kontakt i wybierz go z listy. Dane pojawią się przed zapisem. Działa to także podczas rejestrowania pisma dla skanu i rejestrowania odpowiedzi. Ręczne wpisanie nazwy pozostaje dostępne; zmiana tego pola odłącza wybór kontaktu. Przycisk **Odśwież książkę adresową** pobiera aktualne wpisy bez zamykania formularza. Nowe kontakty dodaje się w osobnej zakładce.

Przy piśmie zapisywana jest kopia danych aktualnych w chwili rejestracji. Nazwa oraz adres są pobierane przez serwer z książki, a nie przyjmowane z kopii przesłanej przez przeglądarkę. Kopia nie obejmuje uwag wewnętrznych. Można ją obejrzeć w sprawie, rozwijając **Dane kontaktowe zapisane przy piśmie**. Zmiana książki nie aktualizuje dawnych pism. Nowa odpowiedź korzysta z aktualnego aktywnego kontaktu; wyłączony kontakt nie jest automatycznie wybierany.

Odznaczenie **Kontakt aktywny** ukrywa go przy nowych pismach. W książce można go ponownie znaleźć przez **Pokaż także wyłączone kontakty** i przywrócić edycją. Usunięcie kontaktu powiązanego z jakimkolwiek pismem jest blokowane; użyj wyłączenia. Kontakty nie wysyłają wiadomości ani dokumentów.

## Baza i API

Dla istniejącej bazy wykonaj kopię zapasową, następnie zastosuj `db/migrations/005_ksiazka_adresowa.sql`. Migracja dodaje `kontakt` oraz dwie opcjonalne kolumny do `pismo`, bez modyfikacji dotychczasowych korespondentów. Nowa pusta książka nie zawiera przykładowych lub domyślonych adresów.

- `GET /api/kontakty?szukaj=...&archiwalne=true` — lista, domyślnie tylko aktywne wpisy.
- `GET /api/kontakty/:id` — szczegóły wpisu.
- `POST /api/kontakty`, `PATCH /api/kontakty/:id` — pełne dane wpisu; zapis tylko dla administratora.
- `DELETE /api/kontakty/:id` — usunięcie niepowiązanego kontaktu, tylko administrator.
- `POST /api/sprawy/:id/pisma` przyjmuje opcjonalne `kontaktId`; nazwa i kopia danych są wyznaczane po stronie serwera w transakcji pisma. Wyłączonego kontaktu nie można wskazać w nowym piśmie.

Skrypt `przypisz-skan` przyjmuje też opcjonalne `nowePismo.kontaktId` w planie. Pozostałe wymagane pola planu pozostają bez zmian. Nie zatwierdza to terminu OCR ani nie wykonuje wysyłki.

## Weryfikacja

Przeszło 88 testów backendu (39 usług i 49 API), bez pominięć, oraz kontrola typów i budowa frontendu. Testy sprawdzają uprawnienia, wyszukiwanie, walidację, zapis kopii danych po stronie serwera, zachowanie historii po edycji i wyłączeniu, ochronę przed usunięciem użytego kontaktu oraz dotychczasowe ręczne wpisy. W osobnej bazie i przeglądarce wykonano dodanie kontaktu, wybór przy piśmie oraz edycję adresu z zachowaniem starego adresu w zapisanej korespondencji.
