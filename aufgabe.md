Aufgabenstellung: Pokemon Booster-Duell (Microservices, Registry & UI)

Ziel des Projekts ist die Entwicklung eines lokalen Microservice-Systems auf Basis von zwei getrennten Docker-Compose-Stacks. 
Im Rahmen der Aufgabe werden die Basis-Infrastruktur eingerichtet, ein Backend sowie ein Frontend entwickelt, die Docker-Images versioniert 
und über eine eigene lokale Container-Registry bereitgestellt.

--------------------------------------------------------------------------------

PROJEKT-AUFGABE: POKEMON BOOSTER-DUELL

TECHNOLOGIE-STACK
- Frontend: HTML / CSS / JavaScript 
- Backend: Node.js (Express/Fastify) oder Python (FastAPI/Flask)
- Datenbank: PostgreSQL + pgAdmin 4
- Infrastruktur: Docker, Docker Compose, Local Registry (registry:2)

--------------------------------------------------------------------------------

Selbstständige API-Analyse:
   - Analysiere die API-Antwort der PokmonAPI selbstständig.
   - Offizielle Dokumentation: https://pokeapi.co/docs/v2#pokemon
   - API-Endpunkt für Testabfragen: GET https://pokeapi.co/api/v2/pokemon/{id_oder_name}
   - Untersuche die JSON-Response der API und leite daraus geeignete Datenbankfelder für die PostgreSQL-Tabelle ab. 
   Du benötigst mindestens:
     * Den Pokemon-Namen
     * Den Haupttyp (für Rahmenfarbe & Typeneffektivität im Spiel)
     * Eine Bild-URL (z. B. ein Offizielles Artwork)
     * Die 6 Basis-Statistiken (HP, Attack, Defense, Special Attack, Special Defense, Speed)
     * Die originale Pokemon-ID der API als eigenständiges Feld (Achtung: Nicht mit deiner Auto-Increment Tabellen-ID verwechseln!)


--------------------------------------------------------------------------------

PHASE 1: INFRASTRUCTURE STACK DEPLOYEN
Erstelle eine Datei `docker-compose.infra.yml` und starte den Infrastruktur-Stack. Alle Services müssen in einem gemeinsamen Docker-Netzwerk (z. B. `pokemon-net`) laufen.

Services im Infra-Stack:
1. `registry`: Image `registry:2` auf Port 5000 mit einem persistenten Docker Volume für gepushte Images.
2. `db`: Image `postgres:alpine` auf Port 5432 mit einem persistenten Volume für die Pokemon-Daten.
3. `pgadmin`: Image `dpage/pgadmin4` auf Port 5050 zur Datenbankverwaltung.

Befehl zum Starten:
$ docker-compose -f docker-compose.infra.yml up -d

--------------------------------------------------------------------------------

PHASE 2: BACKEND & FRONTEND ENTWICKELN & BAUEN

1. Backend Service:
   - Synchronisiere beim Start der App Daten von der PokemonAPI in deine Postgres-DB (nutze das Mapping aus der API-Referenz).
   - API-Endpunkte:
     * GET /api/search?q={query} -> Bsp: /api/search?q=pika
       Sucht via SQL (ILIKE) in der Postgres-DB nach passenden Pokemon-Namen.
     * POST /api/battle
       Zieht per Zufall 5 Pokemon für den Spieler und 5 für den Bot, führt die Kampf-Berechnung durch und gibt das Ergebnis zurück.
   - Erstelle ein Dockerfile im Backend-Ordner.

2. Frontend Service (Zwei Tabs: "Suche" & "Game"):
   - Tab 1 ("Suche"):
     * Textfeld für die Live-Suche inklusive Debounce von 300 ms (verhindert unnötige API-Aufrufe bei jedem Tastendruck).
     * Bei Auswahl eines Pokemons aus den Suchergebnissen wird genau EINE Detailkarte angezeigt.
     * Die Karte hat einen farbigen Rahmen, der sich dem Haupttyp des Pokemons anpasst (z. B. Rot für Feuer, Blau für Wasser, Gelb für Elektro).
   - Tab 2 ("Game"):
     * Enthält den Button Fight.
     * Zeigt die 5 Karten des Spielers und die 5 Karten des Bots nebeneinander an.
     * Jede Karte besitzt ihren typenspezifischen farbigen Rahmen.
     * Die Gewinner-Karten jedes Vergleiches müssen visuell klar hervorgehoben werden (z. B. grüner Schein / "WINNER"-Badge / Ausgrauen der Verlierer-Karten).
   - Erstelle ein Dockerfile im Frontend-Ordner.

3. Build, Tag & Push Workflow:
   Baue die Images lokal, tagge sie für deine lokale Registry und pushe sie:
   $ docker build -t localhost:5000/pokemon-backend:v1.0.0 ./backend
   $ docker build -t localhost:5000/pokemon-frontend:v1.0.0 ./frontend
   $ docker push localhost:5000/pokemon-backend:v1.0.0
   $ docker push localhost:5000/pokemon-frontend:v1.0.0

--------------------------------------------------------------------------------

PHASE 3: APPLICATION STACK DEPLOYEN
Erstelle eine Datei `docker-compose.app.yml`, die das externe Netzwerk `pokemon-net` einbindet und AUSSCHLIESSLICH die gepushten Images aus der lokalen Registry zieht (kein lokaler `build:`-Kontext im Compose-File).

Services im App-Stack:
1. `backend`: Image `localhost:5000/pokemon-backend:v1.0.0`
2. `frontend`: Image `localhost:5000/pokemon-frontend:v1.0.0` (Port 8080)

Befehl zum Starten:
$ docker-compose -f docker-compose.app.yml up -d

--------------------------------------------------------------------------------

PHASE 4: GAMIFICATION & EIGENE LOGIK (DEINE GESTALTUNGSFREIHEIT)

- Karten-Vergleich (Best of 5):
  * Es werden 5 Karten für den Spieler und 5 Karten für den Bot gezogen.
  * Es finden 5 Einzelvergleiche statt: Karte 1 vs. Karte 1, Karte 2 vs. Karte 2, ..., Karte 5 vs. Karte 5.
  * Die jeweils bessere Karte gewinnt den einzelnen Vergleich.
  * Wer von den 5 Vergleichen mindestens 3 gewinnt, entscheidet das Gesamtspiel für sich.
- Typeneffektivität: überlege dir selbst eine Matrix für Typen-Vorteile (z. B. Wasser schlägt Feuer) und wende Schadens-Multiplikatoren an.
- Rating / Score-Berechnung: Konzipiere eine eigene Formel zur Berechnung der Kartenwerte auf Basis der PokemonAPI-Stats (HP, Attack, Defense, Speed etc.).

--------------------------------------------------------------------------------

ABNAHME-KRITERIEN
1. Gepushte Images bleiben auch nach einem Neustart des Registry-Containers dank Docker-Volume erhalten.
2. Das Frontend ist unter `http://localhost:8080` erreichbar und in die zwei Tabs ("Suche" und "Game") unterteilt.
3. Im Tab "Suche" wird nach Auswahl eine Einzelkarte mit typenbasierter Rahmenfarbe gerendert.
4. Im Tab "Game" werden 5 vs. 5 Karten mit farbigen Rahmen angezeigt und die Gewinner-Karten der 5 Einzelvergleiche visuell hervorgehoben.
