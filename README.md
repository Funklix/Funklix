# Campaign Canvas MVP

Ein klickbarer MVP für einen **Creative Collaboration Space** mit blankem Startzustand und Hierarchie-Workflow.

## Enthaltene Kernfeatures

- Blank Canvas beim Laden
- `+ Add node` in der Topbar + `+` pro Node für direkte Child-Erstellung
- Node-Typen mit Farbcodierung:
  - Idea
  - Campaign Variation
  - Content
  - Social Media Posting
  - Landing Page
  - Email Campaign
- Node-Verbindungen (Connect-Button pro Node + Zielnode anklicken)
- Top-down Hierarchie durch Parent-Child Erstellung/Verbindung
- Social-Media-Posting Felder: Plattform, Caption, Hashtags, Preview
- Kommentare pro Node inkl. Username und Datum/Uhrzeit
- Zoom In/Out auf dem Canvas
- Node löschen über Inspector

## Start

```bash
python3 -m http.server 4173
```

Danach im Browser öffnen:

- http://localhost:4173
