# 4. Wnioski i perspektywy rozwoju

Etap pierwszy zamyka się działającą aplikacją, a nie samym projektem na papierze.
Zrealizowane zostały: rejestr spraw i korespondencji, automatyczne wyznaczanie
terminów według reguł, ostrzeganie o terminach zbliżających się i przekroczonych,
chronologia sprawy oraz uwierzytelnianie. Przejście całej ścieżki — od zalogowania,
przez rejestrację pisma, po odczytanie terminu, który z niego powstał — jest
możliwe w interfejsie.

Trzy wnioski wynikają wprost z przebiegu prac.

**Rozdzielenie daty nadania i daty doręczenia okazało się decyzją, wokół której
ułożył się cały model.** Nie jest to szczegół zapisu: pociągnęło za sobą
dopuszczenie pustej daty doręczenia, stan pisma oczekującego na potwierdzenie
odbioru oraz regułę, że termin powstaje dopiero po zdarzeniu początkowym.
Gdyby system liczył od daty nadania, byłby szybszy w budowie i systematycznie
zaniżałby terminy — czyli mylił się w kierunku niebezpiecznym dla użytkownika.

**Zapisanie reguły terminu jako danych, a nie jako gałęzi w kodzie, sprawdziło
się w praktyce.** Siedem reguł startowych, w tym liczona w dniach roboczych
i nieprzesuwana z dnia wolnego, powstało bez jednej zmiany w aplikacji.
Dodanie kolejnej pozostaje operacją na danych.

**Wydzielenie silnika terminów jako funkcji niezależnej od bazy i od protokołu
HTTP pozwoliło sprawdzić testem sytuacje trudne do odtworzenia ręcznie** —
kilka dni wolnych z rzędu, dni ruchome zależne od daty Wielkanocy, przełom
grudnia. Test ujawnił przy okazji błąd w założeniu przyjętym wcześniej: Wielki
Piątek, wskazany pierwotnie jako dzień ustawowo wolny, takim dniem w Polsce nie
jest. Opis i dane rozeszły się w miejscu, które bez testu pozostałoby
niezauważone aż do pierwszego terminu wypadającego w kwietniu.

## Ograniczenia obecnego stanu

Dołączanie dokumentów ma gotowy model danych, ale obsługa plików nie została
jeszcze zaimplementowana. Sesja bezstanowa nie pozwala unieważnić pojedynczego
tokenu przed jego wygaśnięciem. Kalendarz dni ustawowo wolnych wprowadzono do
roku 2030 i wymaga uzupełniania. Zestaw reguł jest reprezentatywny, a nie
kompletnym odwzorowaniem procedur administracyjnych.

## Kierunki dalszych prac

Najbliższe: obsługa plików wraz z sumą kontrolną i powiązaniem dokumentu z pismem,
panel zarządzania kontami dla administratora oraz cykliczna ocena stanu terminów
wraz z powiadomieniem, dziś wykonywana przy odczycie. Dalsze, ujęte w zakresie
dodatkowym: wyszukiwanie pełnotekstowe w treści dokumentów, panel statystyk
i eksport kompletnych akt sprawy.
