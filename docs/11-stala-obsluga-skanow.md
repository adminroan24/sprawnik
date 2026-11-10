# Stała obsługa skanów i lokalny autostart

Stan: 10.11.2026. Rozszerzenie na prośbę autora projektu.

## Działanie

`SCAN_WATCH_ENABLED=true` włącza kolejkę OCR w procesie API. Co 5 sekund po zakończeniu poprzedniego przebiegu sprawdza ona katalogi `epson/` i `kyocera/`. Czeka co najmniej 10 sekund od ostatniej zmiany pliku i zachowuje dotychczasowe limity rozmiaru oraz liczby stron. Jeden błędny plik nie zatrzymuje pozostałych; ponowienie po błędzie następuje najwcześniej po 5 minutach lub po zmianie pliku. Wyłączenie `SCAN_WATCH_ENABLED` zatrzymuje automatyczne odczyty przy kolejnym uruchomieniu API. Ręczny odczyt nadal działa.

Tekst OCR jest zapisany poza udziałem skanerów w `SCAN_ARCHIVE_DIR/ocr-skanow/<sha256>.json`, z prawami 0600. Nazwa zależy od sumy zawartości. Wynik jest odczytywany po restarcie i wykorzystywany przy imporcie do pisma. Dopasowania spraw są wyliczane przy odczycie wyniku, osobno dla zalogowanego właściciela. W tym katalogu nie są zapisywane propozycje zawierające dane innych użytkowników. Wyniki OCR nie mają jeszcze automatycznej retencji; usunięcie oryginału do kosza nie usuwa ich z archiwum.

Zakładka **Skany** odświeża listę co 5 sekund i pokazuje stan odczytu. Po wybraniu gotowego skanu odczytany tekst oraz propozycje spraw i terminów pojawiają się bez dodatkowego uruchamiania OCR. Odświeżanie nie zmienia edytowanej daty ani ręcznie wybranej sprawy.

Kolejka odczytuje dokumenty. Nie tworzy spraw ani pism, nie zgaduje daty wpływu, nie zatwierdza terminów i nie importuje samodzielnie dokumentu. Te działania pozostają w interfejsie lub w przygotowanym planie skryptu `przypisz-skan`. Usługa nie korzysta z tokenu użytkownika, więc wygaśnięcie sesji nie zatrzymuje OCR. Dostęp do listy i wyniku nadal wymaga zalogowanego administratora.

## Usługi systemd użytkownika

Przykłady w `tools/systemd/` zakładają repozytorium `~/projekty/sprawnik`, Node w `/usr/local/bin/node`, Docker w `/usr/bin/docker`, zainstalowane zależności i utworzony kontener `sprawnik-db`. Przed instalacją dostosuj ścieżki do własnego komputera. To lokalny interfejs Vite, a nie konfiguracja publicznego hostingu.

Utwórz prywatny `~/.config/sprawnik/uslugi.env` (0600):

```dotenv
HOST=127.0.0.1
PORT=33119
SCANNER_ENABLED=true
SCAN_WATCH_ENABLED=true
SCAN_INBOX_DIR=/home/NAZWA_UZYTKOWNIKA/Dokumenty/Sprawnik/Skany
SCAN_ARCHIVE_DIR=/home/NAZWA_UZYTKOWNIKA/Dokumenty/Sprawnik/Archiwum
API_PROXY_TARGET=http://127.0.0.1:33119
```

Podmień nazwę użytkownika na faktyczną. Wartości w pliku środowiska nie rozwijają `~`. Konfiguracja bazy i JWT pozostaje w dotychczasowym prywatnym `backend/.env`. Usługa nie potrzebuje hasła administratora aplikacji. API i interfejs są dostępne tylko lokalnie.

Po zakończeniu wcześniejszych procesów zajmujących te same porty:

```bash
mkdir -p ~/.config/systemd/user
cp tools/systemd/sprawnik-api.service tools/systemd/sprawnik-web.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now sprawnik-api.service sprawnik-web.service
```

`Restart=always` wznawia proces po awarii. Autostart usług użytkownika przed zalogowaniem wymaga `Linger=yes` (sprawdzisz przez `loginctl show-user "$USER" -p Linger`); jego włączenie wymaga `loginctl enable-linger "$USER"` z uprawnieniami systemowymi. Sam Docker też musi startować z systemem. Kontener w Compose ma `restart: unless-stopped`; dla istniejącego kontenera ustaw tę samą politykę poleceniem `docker update --restart unless-stopped sprawnik-db`. Nie odtwarzaj wolumenu bazy.

```bash
systemctl --user status sprawnik-api.service sprawnik-web.service
journalctl --user -u sprawnik-api.service -n 30
curl http://127.0.0.1:5180/api/health
```

Zatrzymanie: `systemctl --user stop sprawnik-web.service sprawnik-api.service`. Wyłączenie autostartu: `systemctl --user disable sprawnik-web.service sprawnik-api.service`. Restart komputera zamyka bieżący odczyt; kolejka wznowi go z zachowanego pliku. Wyłączenie lub uśpienie komputera wstrzymuje odbiór i OCR — do pracy przez całą dobę potrzebny jest stale dostępny komputer.

## Sprawdzenie

Testy sprawdzają brak nakładających się przebiegów, zatrzymanie i ponowienie po błędzie, OCR bez tworzenia spraw lub dat, izolację propozycji według właściciela, prawa pliku wyniku, odczyt w nowym procesie bez zainstalowanego w PATH programu OCR oraz odrzucenie starego wyniku po podmianie zawartości. Działanie autostartu należy dodatkowo sprawdzić na komputerze docelowym; test restartu usługi nie oznacza wykonanego restartu systemu.
