# Stalowy Strażnik

City Resilience & Infrastructure Awareness Platform

## Cele projektu

1.  Wizualizacja powiązań między poszczególnymi obiektami strategicznymi.
2.  Ocena ryzyka zagrożeń obiektów infrastruktury krytycznej w Stalowej Woli.
3.  Symulacja wpływu ataku militarnego na pozostałe obiekty infrastruktury.
4.  Monitorowanie zagrożeń i ataków na infrastrukturę krytyczną w mieście.
5.  Analiza słabych punktów i potrzeb w zakresie obronności miasta.

## Funkcjonalności

1.  **Mapa infrastruktury:** Interaktywna mapa z warstwami przedstawiającymi kluczowe obiekty i sieci.
2.  **Analiza powiązań:** Graficzna reprezentacja zależności między elementami infrastruktury.
3.  **Ocena ryzyka:** Automatyczna ocena krytyczności i podatności na zagrożenia dla każdego obiektu.
4.  **Symulacje scenariuszy:** Możliwość symulowania różnych zdarzeń (np. atak, awaria) i obserwacji ich skutków.
5.  **Wsparcie decyzyjne oparte na AI:** Rekomendacje i predykcje generowane przez AI na podstawie danych w czasie rzeczywistym.
6.  **Monitorowanie zagrożeń:** Integracja z zewnętrznymi systemami (radary Sentinel, NASA) w celu wczesnego ostrzegania.

## Scenariusz demonstracyjny

1.  **Alert o ataku rakietowym:** System wyświetla alert. Na mapie podświetlają się potencjalne cele ataku.
2.  **Atak i jego skutki:** Następuje symulowany atak. Widać, jak stopniowo zanika zasilanie w całej okolicy (blackout). Obiekty, które utraciły zasilanie, zmieniają kolor na czerwono.
3.  **Analiza obiektu po ataku:** Po kliknięciu w uszkodzony obiekt, system wyświetla:
    *   **Potencjalne zagrożenia i słabe punkty:** np. tylko jeden sposób komunikacji, brak wystarczającej ochrony fizycznej, łatwy cel dla dronów.
    *   **Możliwe akcje do podjęcia:** wezwanie straży pożarnej, wojska, służb technicznych.
    *   **Ocenę ryzyka:** zaktualizowana ocena po ataku.
    *   **Obiekty powiązane:** graf zależności pokazujący, które inne części systemu są zagrożone.
4.  **Działania AI:** Na podstawie zebranych danych, AI generuje predykcje i rekomendacje:
    *   Co może się wydarzyć w następnej kolejności.
    *   Jakie są najbardziej wrażliwe punkty systemu (Single Point of Failure).
    *   Ile jeszcze infrastruktury może ulec awarii, zanim całe miasto zostanie sparaliżowane.
    *   Wskazówki dla służb w czasie rzeczywistym.

## Źródła danych

Platforma integruje dane z wielu źródeł w celu zapewnienia kompleksowego obrazu sytuacji:
*   Dane o infrastrukturze miasta Stalowa Wola.
*   Dane z czujników monitorujących (radary Sentinel, NASA).

## Implementacja

### Mapa infrastruktury krytycznej

Wykorzystanie biblioteki Leaflet w celu wizualizacji danych na mapie.

### Powiązania między obiektami

Wykorzystanie grafowej bazy danych Neo4j w celu przechowania relacji między obiektami:

#### Węzły (Nodes)

*   obiekty infrastruktury:
    *   energetyka (GPZ, stacje transformatorowe)
    *   wodociągi (ujęcia wody, pompownie)
    *   administracja (urzędy, szpitale)
    *   transport (mosty, węzły drogowe, kolej)
    *   telekomunikacja (BTS, węzły światłowodowe)
*   zasoby:
    *   energia, woda, łączność
*   zdarzenia:
    *   awarie, blackouty (historyczne / symulowane)

#### Relacje (Edges)

*   „zasilany_przez”
*   „obsługuje”
*   „zależny_od”
*   „redundantny_z”
*   „połączony_z”
*   „backup”

### Interfejs użytkownika (Warstwy na mapie)

#### Warstwa 1: Infrastruktura fizyczna
*   [ ] Punkty obiektów (szpitale, elektrownie, mosty)
*   [ ] Linie (kable energetyczne, rurociągi, światłowody, tory kolejowe)
*   [ ] Strefy (np. zasięg sieci wodnej, podział administracyjny)

#### Warstwa 2: Analiza i ocena
*   [ ] Mapa krytyczności (heatmapa ryzyka: zielony, żółty, czerwony)
*   [ ] Poziom redundancji (oznaczenie obiektów z backupem i Single Points of Failure)
*   [ ] Graf zależności (wyświetlany po kliknięciu obiektu, pokazujący powiązania)

#### Warstwa 3: Symulacje i scenariusze
*   [ ] Skutki awarii (np. "utrata zasilania", "zatrucie wodociągów", "zakłócenia radiowe")
*   [ ] Scenariusze militarne (np. "wysadzenie mostów", "atak na GPZ")
*   [ ] Ruchy wojsk (symulacja przemieszczania się jednostek)

#### Warstwa 4: Dane z sensorów
*   [ ] Dane z radarów (Sentinel, NASA)
*   [ ] Inne czujniki (np. jakości wody, natężenia ruchu)


### Ocena ryzyka

Dla każdego obiektu:

#### 1. Krytyczność (C)

*   jak ważny jest obiekt dla miasta
*   np. szpital > szkoła > biuro

#### 2. Zależność (D)

*   ile innych obiektów od niego zależy

#### 3. Redundancja (R)

*   czy istnieje backup (im mniej, tym większe ryzyko)

#### 4. Ekspozycja (E)

*   czy jest narażony (np. na zakłócenia infrastrukturalne / awarie środowiskowe / przeciążenia systemowe — ogólnie, bez wchodzenia w szczegóły zagrożeń)

#### Przykładowy wzór:

$$RISK = (C \cdot 0.4) + (D \cdot 0.3) + (E \cdot 0.2) + ((1 - R) \cdot 0.1)$$

W grafie:

*   centralność w grafie (betweenness centrality)
*   liczba zależnych węzłów
*   długość ścieżek obejścia (redundancy depth)

#### Propagacja oceny ryzyka podczas zdarzenia

*   symulujesz awarię w jednym węźle
*   ile węzłów traci funkcję
*   jak szybko rozprzestrzenia się efekt

## Dalsze możliwości rozwoju

*   Rozbudowa modułu AI o bardziej zaawansowane modele predykcyjne.
*   Integracja z systemami zarządzania kryzysowego w czasie rzeczywistym.
*   Stworzenie aplikacji mobilnej dla służb terenowych.
*   Rozszerzenie analizy o aspekty ekonomiczne i społeczne.