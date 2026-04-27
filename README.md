# Campaign Canvas MVP

Ein klickbarer MVP für einen **Creative Collaboration Space** mit blankem Startzustand, Node-Hierarchie und kollaborativen Kommentaren.

## Enthaltene Kernfeatures

- Blank Canvas beim Laden
- `+ Add node` in der Topbar + `+` pro Node für direkte Child-Erstellung
- Node-Typen mit Farbcodierung (Idea, Campaign Variation, Content, Social Media Posting, Landing Page, Email Campaign)
- Node-Verbindungen (Connect-Button pro Node + Zielnode anklicken)
- Top-down Hierarchie durch Parent-Child Erstellung/Verbindung
- Social-Media-Posting Felder: Plattform, Caption, Hashtags, Preview
- Rechtsklick im Canvas: Post-it Kommentar erstellen (mit Farbwahl, Username, Datum/Uhrzeit, Emoji möglich)
- Dynamische Schriftgröße in Post-it Notizen je nach Textlänge
- Drag & Drop durch linken Mausklick auf die Node
- Listenansicht der Nodes nach Kategorien in der linken Sidebar
- Zoom In/Out nur im Collaboration Space (Canvas)
- Node löschen über Inspector

## Start

```bash
python3 -m http.server 4173
```

Danach im Browser öffnen:

- http://localhost:4173
