# Weryfikacja zakresu podstawowego 10 listopada 2026

Punktem odniesienia był lokalny commit `9c23ae0`. Przegląd porównał osiem funkcji
podstawowych z kodem API, interfejsem i testami. Największe braki dotyczyły obsługi
plików oraz wyszukiwania dokumentów. Poniżej opisano stan po ich uzupełnieniu.

| Funkcja | Stan po zmianach | Miejsce w kodzie i sposób sprawdzenia |
|---|---|---|
| F1. Rejestracja i obsługa spraw | Tworzenie i odczyt spraw; zmiana stanu dostępna także w interfejsie | `routes/sprawy.ts`, `ListaSpraw.tsx`, `WidokSprawy.tsx`; test zmiany stanu i filtrowania |
| F2. Korespondencja przychodząca i wychodząca | Rejestracja pism, dat nadania i doręczenia; późniejsze potwierdzenie doręczenia | `services/rejestracja.ts`, `FormularzPisma.tsx`; testy rejestracji i doręczenia |
| F3. Dołączanie dokumentów do spraw | Przesyłanie i pobieranie plików przez pismo należące do sprawy; metadane, SHA-256 i limit 10 MiB | `db/dokumenty.ts`, `services/dokumenty.ts`, `routes/dokumenty.ts`, `Dokumenty.tsx`; test zapisu i identycznej treści po pobraniu |
| F4. Definiowanie reguł i wyznaczanie terminów | Reguły tworzone przez administratora w API i interfejsie; automatyczne liczenie przy rejestracji pisma | `routes/reguly.ts`, `services/terminy.ts`, `Reguly.tsx`; testy uprawnień, wyliczeń i aktywności reguł |
| F5. Prezentacja terminów i ostrzeganie | Stany terminów obliczane przy odczycie; przegląd i oznaczanie wykonania | `services/przeglad.ts`, `PrzegladTerminow.tsx`; testy kwalifikacji stanów i wykonania |
| F6. Wyszukiwanie i filtrowanie spraw oraz dokumentów | Sprawy według tytułu, znaku, organu i stanu; dokumenty po nazwie i powiązaniu z pismem, w obrębie sprawy | `db/sprawy.ts`, `db/dokumenty.ts`, `Dokumenty.tsx`; testy wyszukiwania, łączenia filtrów i rozdzielenia dostępu |
| F7. Chronologia sprawy | Pisma, terminy i dodane dokumenty w jednym wykazie | `db/sprawy.ts`; test obecności dokumentu w chronologii |
| F8. Uwierzytelnianie i podstawowe uprawnienia | Logowanie; dostęp do własnych spraw i dokumentów; definiowanie reguł przez administratora; zakładanie kont przez CLI | `middleware/uwierzytelnianie.ts`, `skrypty/utworz-konto.ts`; testy logowania i odmowy dostępu, również administratorowi do cudzego dokumentu |

## Przeprowadzone sprawdzenia

- Kontrola typów obu warstw: `npm run typecheck`.
- Budowa interfejsu: `npm run build`.
- 19 testów silnika terminów oraz 21 testów API z osobną bazą PostgreSQL,
  odtworzoną z migracji. Testy plików używają oddzielnego magazynu w `/tmp`.
- Testy dokumentów obejmują również pusty i zbyt duży plik, nazwę ze ścieżką,
  powtarzające się nazwy, brak uprawnień, zmodyfikowany plik i brak pliku.
- Przegląd diffu i kontrola białych znaków: `git diff --check`.

Nie wykonano wizualnego testu interfejsu w przeglądarce: dostępna integracja nie
udostępniła działającej przeglądarki. Kontrola typów, budowa i testy API nie
zastępują sprawdzenia formularzy w przeglądarce.

## Granice obecnej wersji

Dokumenty są wyszukiwane po metadanych, bez przeszukiwania treści i OCR. Nie ma
podglądu ani usuwania plików. Pobieranie odbywa się jako załącznik. Obsługa reguł
w interfejsie obejmuje dodawanie, a konta nadal zakłada się poleceniem. Ostrzeganie
jest częścią przeglądu terminów, bez wysyłki e-mail lub zadania działającego w tle.

Źródła dokumentacji Markdown zostały uaktualnione. PDF w `docs/` pozostaje
oznaczoną migawką etapu pierwszego; DOCX i PDF wymagają ponownego złożenia
i kontroli układu przed przekazaniem wersji końcowej. Zmiany nie zostały wdrożone
na serwer produkcyjny ani opublikowane automatycznie w zdalnym repozytorium.
