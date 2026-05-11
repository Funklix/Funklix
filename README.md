# Campaign Canvas MVP

Ein klickbarer MVP für einen **Creative Collaboration Space** mit blankem Startzustand, Node-Hierarchie und kollaborativen Kommentaren.

## Enthaltene Kernfeatures

- Endless Board mit Touchpad-Unterstützung:
  - Zwei-Finger Scroll in alle Richtungen
  - Pinch-to-Zoom über Touchpad-Geste
- Zoom nur im Collaboration Space
- Umschaltbarer List View per Button in der Topbar
- Hervorgehobener grüner `+ Add node` Button ganz links in der Topbar
- Node-Erstellung über klickbare Typ-Auswahl (kein Freitext nötig)
- `+` pro Node für direkte Child-Erstellung
- Node-Typen mit Farbcodierung (Idea, Campaign Variation, Content, Social Media Posting, Landing Page, Email Campaign)
- Manuelle Node-Verbindung per unterem `+`-Connector: ziehen, dynamische Linie, loslassen auf Zielnode
- Verbindungen können per Klick auf die Linie wieder gelöscht werden
- Top-down Hierarchie durch Parent-Child Erstellung/Verbindung
- Content/Social Image Upload im Inspector
- Bilder per Drag-and-Drop auf das Board erzeugen Content-Nodes mit Bildern
- Social Media Posts übernehmen Bilder vom verbundenen Content-Node
- Social Media Post Node kann mehrere Bilder enthalten
- Größere Bild-Previews mit Hover-Lupe und Klick-Vergrößerung (schließt bei Mouseleave)
- Rechtsklick im Canvas: Post-it Kommentar erstellen (mit Farbwahl, Username, Datum/Uhrzeit, Emoji möglich)
- Post-it Notizen sind verschiebbar und löschbar
- Dynamische Schriftgröße in Post-it Notizen je nach Textlänge
- Drag & Drop von Nodes per linker Maustaste
- Placeholder-/Beispieltexte erscheinen nur wenn Feld leer und nicht fokussiert
- Node löschen über Inspector
- Multi-Select per Drag-Selection und Gruppenverschiebung
- Zoom skaliert gleichmäßig aus der Mitte des aktuellen Viewports
- Audience/Goal/Channel werden top-down entlang von Verbindungen vererbt (bleiben editierbar)
- Unverbundene Nodes erscheinen blasser, verbundene Nodes flashen beim Verbinden
- Impuls-Effekt läuft von Top-Node über das Netzwerk bei neuer Node-Erstellung

## Start

```bash
python3 -m http.server 4173
```

Danach im Browser öffnen:

- http://localhost:4173

## Google Login (Phase 2.1 foundation)

Minimal optional Google sign-in is now available and does **not** gate app usage.

### Required environment variables

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET` (or `SESSION_SECRET`) for signing session cookies

### OAuth callback URL

Configure this Google OAuth redirect URI:

- `https://<your-domain>/api/auth/google/callback`

For local development (if running with a server that supports `/api` routes):

- `http://localhost:3000/api/auth/google/callback`
