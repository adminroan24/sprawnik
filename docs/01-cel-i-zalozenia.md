# 1. Cel i założenia systemu

## 1.1. Problem

W postępowaniach prowadzonych z instytucjami — administracyjnych, sądowych, uczelnianych —
obowiązują terminy o istotnych skutkach prawnych. Ich przekroczenie bywa nieodwracalne:
powoduje utratę prawa do wniesienia środka odwoławczego, pozostawienie sprawy bez rozpoznania
albo powstanie zobowiązania finansowego.

Prowadzenie takich spraw wiąże się z trzema trudnościami:

**Terminy liczone są od daty doręczenia, nie od daty nadania.** Ta sama czynność może mieć
różny termin w zależności od tego, kiedy pismo faktycznie dotarło.

**Różne czynności mają różne terminy.** Odwołanie, zażalenie, uzupełnienie braków i skarga
liczone są odmiennie, a reguły bywają zmieniane.

**Dokumentacja rozprasza się między kanałami.** Pisma przychodzą pocztą, mailem i przez systemy
elektroniczne; potwierdzenia doręczenia trafiają w jeszcze inne miejsce.

W praktyce sprawy prowadzi się w folderach i arkuszach kalkulacyjnych, a terminy pilnuje
pamięcią lub przypomnieniami w kalendarzu. Rozwiązanie to nie skaluje się przy kilku
równoległych sprawach i nie zabezpiecza przed pomyłką w liczeniu terminu.

## 1.2. Cel projektu

Celem projektu jest zaprojektowanie i implementacja aplikacji webowej, która:

- gromadzi w jednym miejscu sprawy, korespondencję i dokumenty,
- **wyznacza terminy automatycznie**, na podstawie konfigurowalnych reguł i daty doręczenia,
- **ostrzega** o terminach zbliżających się i przekroczonych,
- umożliwia szybkie odtworzenie **chronologii sprawy**.

System adresowany jest do osób prowadzących własne sprawy oraz do niewielkich podmiotów
obsługujących sprawy klientów.

## 1.3. Założenia

**Reguły terminów są danymi, nie kodem.** Termin definiuje się przez nazwę, liczbę dni,
sposób liczenia i zdarzenie początkowe. Dodanie nowej reguły nie wymaga zmiany aplikacji.

**Punktem odniesienia jest data doręczenia.** Każde pismo przychodzące może mieć odrębnie
odnotowaną datę nadania i datę doręczenia; terminy liczone są od tej drugiej.

**Dokument należy do sprawy, nie do folderu.** Pliki przypisywane są do konkretnego pisma
w konkretnej sprawie.

**Charakter demonstracyjny.** Projekt nie odwzorowuje kompletnych procedur administracyjnych.
Przygotowano reprezentatywny zestaw reguł pokazujący działanie mechanizmu.

## 1.4. Zakres podstawowy

| Nr | Funkcja |
|----|---------|
| F1 | Rejestracja i obsługa spraw |
| F2 | Rejestracja korespondencji przychodzącej i wychodzącej |
| F3 | Dołączanie dokumentów do spraw |
| F4 | Definiowanie reguł terminów i automatyczne ich wyznaczanie |
| F5 | Prezentacja terminów oraz ostrzeganie o zbliżających się i przekroczonych |
| F6 | Wyszukiwanie i filtrowanie spraw oraz dokumentów |
| F7 | Generowanie chronologii sprawy |
| F8 | Uwierzytelnianie użytkowników i podstawowe zarządzanie uprawnieniami |

## 1.5. Zakres dodatkowy

Realizowany dopiero po ukończeniu zakresu podstawowego i niewarunkujący ukończenia projektu:
wyszukiwanie pełnotekstowe w treści dokumentów, rozbudowany panel statystyk, zaawansowany
eksport kompletnych akt.

## 1.6. Poza zakresem

Integracja z systemami e-Doręczeń i ePUAP, kwalifikowany podpis elektroniczny, automatyczne
pobieranie korespondencji ze skrzynek pocztowych, rozpoznawanie tekstu ze skanów, obsługa
wielu organizacji w jednej instalacji.
