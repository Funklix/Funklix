# Campaign Canvas MVP

Ein klickbarer MVP für einen **Creative Collaboration Space** mit blankem Startzustand, Node-Hierarchie und kollaborativen Kommentaren.

## Enthaltene Kernfeatures

- Endless Board mit Touchpad-Unterstützung:
  - Zwei-Finger Scroll in alle Richtungen
  - Pinch-to-Zoom über Touchpad-Geste
- Zoom nur im Collaboration Space
- Umschaltbarer List View per Button in der Topbar
- `+ Add node` in der Topbar + `+` pro Node für direkte Child-Erstellung
- Node-Typen mit Farbcodierung (Idea, Campaign Variation, Content, Social Media Posting, Landing Page, Email Campaign)
- Node-Verbindungen (Connect-Button pro Node + Zielnode anklicken)
- Top-down Hierarchie durch Parent-Child Erstellung/Verbindung
- Content/Social Image Upload im Inspector
- Bilder per Drag-and-Drop auf das Board erzeugen Content-Nodes mit Bildern
- Social Media Posts übernehmen Bilder vom verbundenen Content-Node
- Social Media Post Node kann mehrere Bilder enthalten
- Rechtsklick im Canvas: Post-it Kommentar erstellen (mit Farbwahl, Username, Datum/Uhrzeit, Emoji möglich)
- Post-it Notizen sind verschiebbar und löschbar
- Dynamische Schriftgröße in Post-it Notizen je nach Textlänge
- Drag & Drop von Nodes per linker Maustaste
- Placeholder-/Beispieltexte erscheinen nur wenn Feld leer und nicht fokussiert
- Node löschen über Inspector

## Start

```bash
python3 -m http.server 4173
```

Danach im Browser öffnen:

- http://localhost:4173
