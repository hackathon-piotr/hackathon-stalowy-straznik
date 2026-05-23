# Stalowy Strażnik

W jednym zdaniu do czego sluzy aplikacja.

## Cele projektu

1. Wizualizacja powiązań między poszczególnymi obiektami strategicznymi.
2. Ocena ryzyka zagrożeń obiektów infrastruktury krytycznej w Stalowej Woli.
3. Symulacja wpływu ataku militarnego na pozostałe obiekty infrastruktury.
4. Monitorowanie zagrożeń i ataków na infrastrukturę krytyczną w mieście.
5. Analiza słabych punktów i potrzeb w zakresie obronności miasta.

## Funkcjolności

1. ...
2. ...
3. ...
4. ...
5. ...

## Żródła danych

Tutaj skąd pobralismy dane i z jakich sytstemow aplikacja monitoruje zagrozenia.

## Implementacja

### Mapa infrastruktury krytycznej

Wykorzystanie biblioteki Leaflet w celu wizualizacji danych na mapie.

### Powiązania między obiektami

Wykorzystanie grafowej bazy danych Neo4j w celu przechowania relacji między obiektami:

#### Węzły (Nodes)

* obiekty infrastruktury:
    * energetyka (GPZ, stacje transformatorowe)
    * wodociągi (ujęcia wody, pompownie)
    * administracja (urzędy, szpitale)
    * transport (mosty, węzły drogowe, kolej)
    * telekomunikacja (BTS, węzły światłowodowe)
* zasoby:
    * energia, woda, łączność
* zdarzenia:
    * awarie, blackouty (historyczne / symulowane)

#### Relacje (Edges)

* „zasilany_przez”
* „obsługuje”
* „zależny_od”
* „redundantny_z”
* „połączony_z”
* „backup”

### Interfejs użytkownika

#### Warstwa 1: fizyczna infrastruktura

* punkty obiektów
* linie (kable, rurociągi, sieci)
* strefy (np. zasięg sieci wodnej)

#### Warstwa 2: zależności (graf)

* kliknięcie obiektu → pokazuje:

    * od czego zależy
    * co przestanie działać, jeśli padnie

#### Warstwa 3: krytyczność (heatmap)

* kolor:

    * zielony → niska krytyczność
    * żółty → średnia
    * czerwony → wysoka

#### Warstwa 4: redundancja

* czy obiekt ma backup
* czy jest single point of failure

#### Warstwa 5: scenariusze awaryjne (symulacje)

* „utrata zasilania”
* „utrata łączności”
* „awaria wodociągu”

### Ocena ryzyka

Dla każdego obiektu:

#### 1. Krytyczność (C)

* jak ważny jest obiekt dla miasta
* np. szpital > szkoła > biuro

#### 2. Zależność (D)

* ile innych obiektów od niego zależy

#### 3. Redundancja (R)

* czy istnieje backup (im mniej, tym większe ryzyko)

#### 4. Ekspozycja (E)

* czy jest narażony (np. na zakłócenia infrastrukturalne / awarie środowiskowe / przeciążenia systemowe — ogólnie, bez wchodzenia w szczegóły zagrożeń)

#### Przykładowy wzór:

[
RISK = (C \cdot 0.4) + (D \cdot 0.3) + (E \cdot 0.2) + ((1 - R) \cdot 0.1)
]

W grafie:

* centralność w grafie (betweenness centrality)
* liczba zależnych węzłów
* długość ścieżek obejścia (redundancy depth)

#### Propagacja oceny ryzyka podczas zdarzenia

* symulujesz awarię w jednym węźle
* ile węzłów traci funkcję
* jak szybko rozprzestrzenia się efekt

## Dalsze możliwości rozwoju

Kilka zdań lub punktów, jak dalej rozwijać aplikację i co można dodać.