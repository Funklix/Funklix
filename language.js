(function (root, factory) {
  const api = factory(root && root.localStorage);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FunklixLanguage = api;
})(typeof window !== "undefined" ? window : null, function (storage) {
  "use strict";

  const UI_LANGUAGES = Object.freeze(["en", "de"]);
  const CAMPAIGN_LANGUAGES = Object.freeze(["en", "de", "es"]);
  const DEFAULT_UI_LANGUAGE = "en";
  const DEFAULT_CAMPAIGN_LANGUAGE = "en";
  const STORAGE_KEY = "funklix.languagePreferences.v1";
  const LANGUAGE_NAMES = Object.freeze({ en: "English", de: "German", es: "Spanish" });
  const german = {
    "Home": "Startseite", "Boards": "Boards", "Campaign Canvas": "Kampagnen-Canvas",
    "Content Workspace": "Content-Arbeitsbereich", "More filters": "Weitere Filter", "Needs review": "Prüfung nötig", "Unscheduled": "Ungeplant", "Content Library": "Inhaltsbibliothek", "Review Queue": "Prüfwarteschlange", "Calendar": "Kalender",
    "Month": "Monat", "Agenda": "Agenda", "Today": "Heute", "Previous period": "Vorheriger Zeitraum", "Next period": "Nächster Zeitraum",
    "Schedule": "Planen", "Reschedule": "Neu planen", "Remove schedule": "Planung entfernen", "Timezone": "Zeitzone",
    "Internal planning is available before approval.": "Interne Planung ist bereits vor der Freigabe möglich.",
    "Planning does not publish externally.": "Die Planung veröffentlicht nicht extern.",
    "Add the missing post content before planning a date.": "Ergänze den fehlenden Post-Inhalt, bevor du ein Datum planst.",
    "Choose a platform before planning this post.": "Wähle eine Plattform aus, bevor du diesen Post planst.",
    "This post changed while the scheduling dialog was open. Review the current version.": "Dieser Post wurde geändert, während der Planungsdialog geöffnet war. Prüfe die aktuelle Version.",
    "The editorial status changed while the dialog was open. Review the current status.": "Der redaktionelle Status wurde während des Dialogs geändert. Prüfe den aktuellen Status.",
    "The schedule changed while the dialog was open. Review the current plan.": "Die Planung wurde während des Dialogs geändert. Prüfe den aktuellen Plan.",
    "This content no longer exists on the current Board.": "Dieser Inhalt existiert nicht mehr auf dem aktuellen Board.",
    "You no longer have permission to plan this content.": "Du hast keine Berechtigung mehr, diesen Inhalt zu planen.",
    "Scheduled in the internal plan.": "Im internen Plan eingeplant.", "Rescheduled in the internal plan.": "Im internen Plan neu eingeplant.", "Removed from the internal plan.": "Aus dem internen Plan entfernt.",
    "Internal plan": "Interner Plan", "External publishing not connected": "Externe Veröffentlichung nicht verbunden",
    "scheduled in the internal plan": "im internen Plan eingeplant", "rescheduled in the internal plan": "im internen Plan neu eingeplant", "removed from the internal plan": "aus dem internen Plan entfernt",
    "Board Brand Core": "Board Brand Core",
    "AI Brain": "KI-Brain", "Insights": "Einblicke", "Funnel Simulator": "Funnel-Simulator", "Activity": "Aktivität",
    "AI Insights": "KI-Einblicke", "Measured performance": "Gemessene Performance",
    "See what is ready, what needs attention, and where to focus next.": "Sieh, was bereit ist, was Aufmerksamkeit benötigt und worauf du dich als Nächstes konzentrieren solltest.",
    "Executive health overview": "Überblick zur Kampagnengesundheit", "A compact view of current Canvas readiness.": "Ein kompakter Überblick über die aktuelle Canvas-Bereitschaft.",
    "No areas need attention right now.": "Derzeit benötigt kein Bereich Aufmerksamkeit.", "Journey summary": "Phasenübersicht", "stages covered": "Phasen abgedeckt", "stages missing": "Phasen fehlen",
    "Channel distribution": "Kanalverteilung", "channel": "Kanal", "channels": "Kanäle",
    "Campaign journey coverage": "Abdeckung der Kampagnenphasen", "See which stages of the campaign journey are supported by content in your Canvas.": "Sieh, welche Phasen der Kampagnenreise durch Inhalte in deinem Canvas abgedeckt sind.",
    "Missing content": "Inhalte fehlen", "Canvas content coverage, not measured conversion performance.": "Abdeckung durch Canvas-Inhalte, keine gemessene Conversion-Performance.",
    "CTA variation among existing CTAs": "CTA-Variation der vorhandenen CTAs", "The existing CTA is distinct. Adding more purposeful CTA variations could support different campaign stages.": "Die vorhandene CTA ist klar unterscheidbar. Weitere gezielte CTA-Varianten könnten unterschiedliche Kampagnenphasen besser unterstützen.",
    "This check is complete and consistent in the current Canvas.": "Diese Prüfung ist im aktuellen Canvas vollständig und konsistent.", "This area has a good foundation in the current Canvas.": "Dieser Bereich hat im aktuellen Canvas eine gute Grundlage.", "Review the related evidence and opportunity.": "Prüfe die zugehörigen Nachweise und das Potenzial.", "Content required for this check is incomplete.": "Die für diese Prüfung erforderlichen Inhalte sind unvollständig.",
    "Verified metrics can appear here when available.": "Verifizierte Kennzahlen können hier erscheinen, sobald sie verfügbar sind.", "Ask your Brand advisor about this campaign.": "Frag deinen Brand-Berater zu dieser Kampagne.", "I can explain Canvas diagnostics and advise without changing it.": "Ich kann Canvas-Diagnosen erklären und beraten, ohne den Canvas zu verändern.", "Brand advisor avatar": "Avatar des Brand-Beraters",
    "Based on the structure and content of your current Canvas.": "Basierend auf der Struktur und den Inhalten deines aktuellen Canvas.",
    "See what is ready and where your campaign needs attention.": "Sieh auf einen Blick, was bereit ist und wo deine Kampagne Aufmerksamkeit benötigt.",
    "Campaign readiness": "Kampagnenbereitschaft", "Areas needing attention": "Bereiche mit Handlungsbedarf",
    "Your campaign structure is mostly complete, with a few areas still worth refining.": "Deine Kampagnenstruktur ist weitgehend vollständig; einige Bereiche lassen sich noch verbessern.",
    "Review these areas to make the campaign clearer and more complete.": "Prüfe diese Bereiche, um die Kampagne klarer und vollständiger zu machen.",
    "See which campaign stages are represented.": "Sieh, welche Kampagnenphasen abgedeckt sind.", "Content by supported channel.": "Inhalte nach unterstütztem Kanal.",
    "Strong": "Stark", "Good foundation": "Gute Grundlage", "Needs attention": "Benötigt Aufmerksamkeit", "Incomplete": "Unvollständig",
    "Awareness": "Aufmerksamkeit", "Interest": "Interesse", "Consideration": "Erwägung", "Conversion": "Conversion", "Retention": "Kundenbindung",
    "No supported channel content is present yet.": "Noch sind keine Inhalte für unterstützte Kanäle vorhanden.",
    "Campaign results such as reach, engagement, conversions, and revenue will appear here when a verified data source is connected.": "Kampagnenergebnisse wie Reichweite, Engagement, Conversions und Umsatz erscheinen hier, sobald eine verifizierte Datenquelle verbunden ist.",
    "How this is calculated": "So wird das berechnet", "Focus on the next useful improvements for this Canvas.": "Konzentriere dich auf die nächsten sinnvollen Verbesserungen für diesen Canvas.",
    "High priority": "Hohe Priorität", "Worth improving": "Verbesserung empfohlen", "Minor improvement": "Kleine Optimierung",
    "Assumptions": "Annahmen", "Diagnostics use only the fields and supported node roles present in the current Canvas.": "Die Diagnosen verwenden nur Felder und unterstützte Node-Rollen, die im aktuellen Canvas vorhanden sind.",
    "Most essential campaign elements are present. Review the highlighted gaps before launch.": "Die meisten wesentlichen Kampagnenelemente sind vorhanden. Prüfe die markierten Lücken vor dem Start.",
    "The checklist shows which stages are present and which still need content.": "Die Checkliste zeigt, welche Phasen vorhanden sind und für welche noch Inhalte fehlen.",
    "Several audience descriptions may differ across the Canvas. Align them to keep the campaign focused.": "Mehrere Zielgruppenbeschreibungen im Canvas können voneinander abweichen. Gleiche sie ab, damit die Kampagne fokussiert bleibt.",
    "Most campaign content follows a similar tone, with any variations highlighted below.": "Die meisten Kampagneninhalte folgen einer ähnlichen Tonalität; Abweichungen werden unten hervorgehoben.",
    "Trust-building elements help complete the campaign structure.": "Vertrauensbildende Elemente vervollständigen die Kampagnenstruktur.",
    "Calls to action are present, but some content may need a clearer next step.": "Handlungsaufforderungen sind vorhanden, aber manche Inhalte benötigen möglicherweise einen klareren nächsten Schritt.",
    "See how campaign content is distributed across supported channels.": "Sieh, wie Kampagneninhalte auf unterstützte Kanäle verteilt sind.",
    "Evidence from your campaign Canvas": "Erkenntnisse aus deinem Kampagnen-Canvas",
    "Understand what the current Canvas contains, where structural gaps remain, and which areas deserve attention.": "Verstehe, was der aktuelle Canvas enthält, wo strukturelle Lücken bestehen und welche Bereiche Aufmerksamkeit benötigen.",
    "Overview": "Überblick", "A truthful summary of the structure and content in the current Canvas.": "Eine verlässliche Zusammenfassung der Struktur und Inhalte im aktuellen Canvas.",
    "Measured Performance": "Gemessene Performance", "No analytics data connected": "Keine Analytics-Daten verbunden",
    "Funklix is not currently receiving verified reach, engagement, conversion, revenue, spend, or attribution data for this campaign.": "Funklix erhält derzeit keine verifizierten Daten zu Reichweite, Engagement, Conversions, Umsatz, Ausgaben oder Attribution für diese Kampagne.",
    "Canvas diagnostics remain available below and evaluate campaign structure and content only.": "Die Canvas-Diagnosen darunter bleiben verfügbar und bewerten ausschließlich Kampagnenstruktur und Inhalte.",
    "Data status: Unavailable": "Datenstatus: Nicht verfügbar",
    "Verified performance data will appear here after a supported data source or import workflow is added.": "Verifizierte Performance-Daten erscheinen hier, sobald eine unterstützte Datenquelle oder ein Import-Workflow verfügbar ist.",
    "Data connections are planned.": "Datenverbindungen sind geplant.",
    "Canvas Diagnostics": "Canvas-Diagnosen", "Opportunities": "Potenziale", "Deterministically prioritized findings from the current Canvas.": "Deterministisch priorisierte Erkenntnisse aus dem aktuellen Canvas.",
    "Data and Methodology": "Daten und Methodik", "How to interpret these current-Canvas diagnostics.": "So sind diese Diagnosen des aktuellen Canvas zu verstehen.",
    "Deterministic diagnostic": "Deterministische Diagnose", "Current Canvas": "Aktueller Canvas", "Canvas nodes": "Canvas-Nodes", "Last analyzed": "Zuletzt analysiert",
    "Includes unsaved Canvas changes": "Enthält ungespeicherte Canvas-Änderungen", "Based on the currently loaded saved Canvas": "Basiert auf dem aktuell geladenen gespeicherten Canvas",
    "Refresh insights": "Erkenntnisse aktualisieren", "Provenance": "Herkunft", "Unavailable": "Nicht verfügbar",
    "Priority findings": "Priorisierte Erkenntnisse", "Highest severity": "Höchster Schweregrad", "No current findings": "Keine aktuellen Erkenntnisse",
    "Channel coverage": "Kanalabdeckung", "Five-stage mapping from explicit fields and supported node roles.": "Fünfstufige Zuordnung aus expliziten Feldern und unterstützten Node-Rollen.",
    "Counts Social Media Posting nodes by their current platform value.": "Zählt Social-Media-Posting-Nodes nach ihrem aktuellen Plattformwert.",
    "A Board-level diagnostic of structural coverage and consistency; it is not measured performance.": "Eine Diagnose der strukturellen Abdeckung und Konsistenz auf Board-Ebene; sie ist keine gemessene Performance.",
    "Structure and readiness": "Struktur und Bereitschaft", "Funnel coverage": "Funnel-Abdeckung", "Strategy and consistency": "Strategie und Konsistenz", "Content and channels": "Inhalte und Kanäle",
    "Scope": "Umfang", "Method": "Methode", "Current Board": "Aktuelles Board", "Structural checks": "Strukturprüfungen", "Canvas readiness formula": "Formel zur Canvas-Bereitschaft", "Deterministic finding ordering": "Deterministische Erkenntnisreihenfolge", "Funnel-stage mapping": "Funnel-Stufen-Zuordnung", "Platform counting": "Plattformzählung", "Distinct audience labels": "Unterschiedliche Zielgruppenbezeichnungen", "Distinct tone labels": "Unterschiedliche Tonalitätsbezeichnungen", "Landing Page trust-field presence": "Vorhandensein des Vertrauensfelds auf Landingpages", "CTA variation check": "Prüfung der CTA-Varianten",
    "CTA structure needs attention": "Die CTA-Struktur benötigt Aufmerksamkeit", "One or more eligible Canvas nodes do not contain a clear CTA.": "Mindestens ein geeigneter Canvas-Node enthält keinen klaren CTA.",
    "Funnel-stage gaps remain": "Lücken bei Funnel-Stufen bleiben bestehen", "The current deterministic stage mapping leaves one or more campaign stages uncovered.": "Die aktuelle deterministische Stufenzuordnung lässt mindestens eine Kampagnenstufe unabgedeckt.",
    "Trust-layer coverage is incomplete": "Die Abdeckung der Vertrauensebene ist unvollständig", "Landing Page trust evidence is absent from the current Canvas.": "Im aktuellen Canvas fehlen Vertrauensnachweise auf Landingpages.",
    "ICP consistency needs review": "Die ICP-Konsistenz sollte geprüft werden", "Multiple audience labels are present across the current Canvas.": "Im aktuellen Canvas sind mehrere Zielgruppenbezeichnungen vorhanden.",
    "Tone consistency needs review": "Die Tonalitätskonsistenz sollte geprüft werden", "More than two tone values are present across the current Canvas.": "Im aktuellen Canvas sind mehr als zwei Tonalitätswerte vorhanden.",
    "CTA variation is limited": "Die CTA-Variation ist begrenzt", "The current Canvas contains fewer than two distinct CTA values.": "Der aktuelle Canvas enthält weniger als zwei unterschiedliche CTA-Werte.",
    "Critical": "Kritisch", "Important": "Wichtig", "Opportunity": "Potenzial", "Information": "Information", "Severity": "Schweregrad", "Category": "Kategorie", "Affected nodes": "Betroffene Nodes", "more": "weitere", "Node": "Node",
    "Show on Canvas": "Im Canvas anzeigen", "Ask AI Brain": "AI Brain fragen", "This insight is no longer current. Refresh AI Insights.": "Diese Erkenntnis ist nicht mehr aktuell. Aktualisiere AI Insights.", "Affected nodes could not be identified reliably.": "Betroffene Nodes konnten nicht zuverlässig bestimmt werden.",
    "Your Canvas does not contain enough campaign structure for diagnostics yet.": "Dein Canvas enthält noch nicht genügend Kampagnenstruktur für Diagnosen.", "Add or generate campaign nodes, then return to AI Insights.": "Füge Kampagnen-Nodes hinzu oder generiere sie und kehre anschließend zu AI Insights zurück.",
    "AI Insights could not analyze the current Canvas.": "AI Insights konnte den aktuellen Canvas nicht analysieren.", "Your campaign data was not changed. Refresh the insights or return to the Canvas.": "Deine Kampagnendaten wurden nicht verändert. Aktualisiere die Erkenntnisse oder kehre zum Canvas zurück.",
    "View data classifications, methods, and limitations": "Datenklassifikationen, Methoden und Einschränkungen anzeigen", "Measured": "Gemessen", "Inferred": "Abgeleitet", "Simulated": "Simuliert", "User-entered": "Manuell eingegeben",
    "Verified observations from a supported data source.": "Verifizierte Beobachtungen aus einer unterstützten Datenquelle.", "Repeatable rules applied to the current Canvas.": "Wiederholbare Regeln, die auf den aktuellen Canvas angewendet werden.", "A conclusion derived from disclosed Canvas rules.": "Eine aus offengelegten Canvas-Regeln abgeleitete Schlussfolgerung.", "An assumption-based scenario, not a measurement.": "Ein annahmenbasiertes Szenario, keine Messung.", "Information supplied directly by a user.": "Direkt von einer Person eingegebene Informationen.", "No reliable value is currently available.": "Derzeit ist kein verlässlicher Wert verfügbar.",
    "Current source": "Aktuelle Quelle", "Diagnostic methods": "Diagnosemethoden", "Limitations": "Einschränkungen",
    "Structural checks, funnel-stage mapping, platform counting, CTA checks, ICP similarity, tone consistency, trust-layer coverage, and title/body or social diagnostics are shown only when supported by current calculations.": "Strukturprüfungen, Funnel-Stufen-Zuordnung, Plattformzählung, CTA-Prüfungen, ICP-Ähnlichkeit, Tonalitätskonsistenz, Vertrauensebenen-Abdeckung sowie Titel-/Text- oder Social-Diagnosen werden nur angezeigt, wenn aktuelle Berechnungen sie unterstützen.",
    "Canvas diagnostics evaluate the structure and content currently available in Funklix. They do not measure audience response, media delivery, conversions, revenue, or business impact.": "Canvas-Diagnosen bewerten die aktuell in Funklix vorhandene Struktur und die Inhalte. Sie messen keine Zielgruppenreaktionen, Medienausspielung, Conversions, Umsätze oder geschäftlichen Auswirkungen.",
    "No campaign analytics are connected yet.": "Noch sind keine Kampagnen-Analysedaten verbunden.",
    "Reach, engagement, conversions, attribution, revenue, and channel performance will appear here only when they are supplied by a verified data source.": "Reichweite, Interaktionen, Conversions, Attribution, Umsatz und Channel-Performance werden hier erst angezeigt, wenn sie aus einer verifizierten Datenquelle stammen.",
    "Data status: No analytics connected": "Datenstatus: Keine Analytics verbunden",
    "Canvas diagnostics": "Canvas-Diagnosen", "Source: Current Canvas": "Quelle: Aktueller Canvas",
    "Analysis type: Deterministic diagnostic": "Analysetyp: Deterministische Diagnose",
    "These checks evaluate campaign structure and content. They are not measured campaign results.": "Diese Prüfungen bewerten Kampagnenstruktur und Inhalte. Sie sind keine gemessenen Kampagnenergebnisse.",
    "Includes unsaved Canvas changes.": "Enthält ungespeicherte Canvas-Änderungen.",
    "Based on the currently loaded saved Canvas.": "Basiert auf dem aktuell geladenen gespeicherten Canvas.",
    "No Board is open. Open an authorized Board to view Canvas diagnostics.": "Kein Board ist geöffnet. Öffne ein autorisiertes Board, um Canvas-Diagnosen anzuzeigen.",
    "Board is loading. Canvas diagnostics will appear when the authorized Canvas is ready.": "Das Board wird geladen. Canvas-Diagnosen erscheinen, sobald der autorisierte Canvas bereit ist.",
    "This Canvas is empty. Add campaign content to make deterministic diagnostics available.": "Dieser Canvas ist leer. Füge Kampagneninhalte hinzu, damit deterministische Diagnosen verfügbar werden.",
    "Canvas diagnostics are unavailable for this Board.": "Canvas-Diagnosen sind für dieses Board nicht verfügbar.",
    "Canvas diagnostics could not be calculated. No diagnostic result is shown.": "Canvas-Diagnosen konnten nicht berechnet werden. Es wird kein Diagnoseergebnis angezeigt.",
    "Canvas readiness": "Canvas-Bereitschaft", "Funnel-stage coverage": "Funnel-Phasenabdeckung",
    "Canvas nodes by platform": "Canvas-Knoten nach Plattform", "CTA structure": "CTA-Struktur",
    "ICP consistency": "ICP-Konsistenz", "Tone consistency": "Tonalitätskonsistenz", "Trust-layer coverage": "Abdeckung der Vertrauensebene",
    "Covered": "Abgedeckt", "Missing": "Fehlend", "No stages covered": "Keine Phasen abgedeckt",
    "No stages missing": "Keine Phasen fehlen", "No platform nodes": "Keine Plattform-Knoten",
    "Diagnostic score": "Diagnosewert", "Issues": "Probleme", "None detected": "Keine erkannt",
    "Missing CTA": "CTA fehlt",
    "Add CTA variations for different stages.": "Füge CTA-Varianten für unterschiedliche Funnel-Phasen hinzu.",
    "Tone shifts across nodes are high.": "Die Tonalität unterscheidet sich deutlich zwischen den Knoten.",
    "Add trust-building proof in Landing Page nodes.": "Füge vertrauensbildende Nachweise in Landingpage-Knoten hinzu.",
    "Create campaign": "Kampagne erstellen", "+ Add node": "+ Knoten hinzufügen",
    "Search nodes...": "Knoten suchen...", "Sign in with Google": "Mit Google anmelden", "Sign out": "Abmelden",
    "Filters": "Filter", "Utilities": "Werkzeuge", "Copy Link": "Link kopieren",
    "View-only board. Changes cannot be saved.": "Board nur zur Ansicht. Änderungen können nicht gespeichert werden.",
    "Board": "Board", "Save Board": "Board speichern", "Duplicate Board": "Board duplizieren",
    "New Board": "Neues Board", "Reset Board": "Board zurücksetzen", "Claim Board": "Board übernehmen",
    "View": "Ansicht", "Board View": "Board-Ansicht", "List View": "Listenansicht", "Calendar View": "Kalenderansicht",
    "Layout": "Layout", "Fit to Board": "An Board anpassen", "Auto Arrange": "Automatisch anordnen",
    "Compact All": "Alle einklappen", "Expand All": "Alle ausklappen", "Owned by you": "In deinem Besitz",
    "Node Type": "Knotentyp", "Variation": "Variante", "Content": "Inhalt", "Landing": "Landingpage",
    "Social": "Social", "Platform": "Plattform", "Status": "Status", "Ownership": "Zuständigkeit",
    "State / Funnel": "Phase / Funnel", "My Nodes": "Meine Knoten", "Unassigned": "Nicht zugewiesen",
    "Campaign Generator V3": "Kampagnengenerator V3", "Generate Campaign (V3)": "Kampagne erstellen (V3)",
    "Use the feature-flagged V3 AI compatibility flow to build a deterministic campaign funnel on the canvas.": "Erstelle mit dem V3-KI-Ablauf einen strukturierten Kampagnen-Funnel auf dem Canvas.",
    "Campaign Idea": "Kampagnenidee", "Additional Context": "Zusätzlicher Kontext", "Channel": "Kanal",
    "Variations": "Varianten", "Posts per Variation": "Posts pro Variante", "Landing Page": "Landingpage",
    "Include Landing Page": "Landingpage einbeziehen", "Email Campaign": "E-Mail-Kampagne",
    "Include Email Campaign": "E-Mail-Kampagne einbeziehen", "Use legacy generator": "Alten Generator verwenden",
    "Cancel": "Abbrechen", "Generate Campaign": "Kampagne erstellen", "Please enter a campaign idea.": "Bitte gib eine Kampagnenidee ein.",
    "Analyzing Strategy...": "Strategie wird analysiert...", "Generating Campaign...": "Kampagne wird erstellt...",
    "Brand AI Campaign Creator": "Brand-KI-Kampagnenersteller", "Your Brand AI is building your campaign": "Deine Brand-KI erstellt deine Kampagne",
    "Designing a campaign tailored to your audience, channel and goals.": "Eine Kampagne wird passend zu Zielgruppe, Kanal und Zielen gestaltet.",
    "Understanding your campaign": "Deine Kampagne verstehen", "Reading your campaign brief...": "Dein Kampagnenbriefing wird gelesen...",
    "Learning your brand context": "Deinen Markenkontext lernen", "Tuning the work to your Brand Brain...": "Die Arbeit wird auf dein Brand Brain abgestimmt...",
    "Exploring campaign angles": "Kampagnenansätze erkunden", "Finding the strongest angles...": "Die stärksten Ansätze werden ermittelt...",
    "Creating content strategy": "Content-Strategie erstellen", "Turning your strategy into content...": "Deine Strategie wird in Inhalte umgesetzt...",
    "Generating social content": "Social Content erstellen", "Drafting social posts and messaging paths...": "Social Posts und Botschaften werden entworfen...",
    "Preparing landing page": "Landingpage vorbereiten", "Preparing conversion assets...": "Conversion-Assets werden vorbereitet...",
    "Running quality checks": "Qualitätsprüfungen durchführen", "Checking campaign quality...": "Die Kampagnenqualität wird geprüft...",
    "Optimizing campaign structure": "Kampagnenstruktur optimieren", "Optimizing campaign structure...": "Die Kampagnenstruktur wird optimiert...",
    "Building campaign canvas": "Kampagnen-Canvas aufbauen", "Assembling your canvas...": "Dein Canvas wird zusammengestellt...",
    "Almost ready...": "Fast fertig...", "Campaign Creation Complete": "Kampagne vollständig erstellt",
    "Campaign Ready": "Kampagne bereit", "Your Brand AI has created, checked and assembled your campaign.": "Deine Brand-KI hat die Kampagne erstellt, geprüft und zusammengestellt.",
    "Strategy": "Strategie", "Quality Checked": "Qualität geprüft", "Canvas Ready": "Canvas bereit",
    "Reveal Campaign": "Kampagne anzeigen", "Campaign Creation Paused": "Kampagnenerstellung pausiert",
    "We couldn’t finish this campaign": "Diese Kampagne konnte nicht fertiggestellt werden",
    "Something interrupted generation. You can retry with the same settings or close this window and try again later.": "Die Erstellung wurde unterbrochen. Du kannst es mit denselben Einstellungen erneut versuchen oder das Fenster schließen.",
    "Close": "Schließen", "Retry": "Erneut versuchen", "Campaign generated successfully.": "Kampagne erfolgreich erstellt.",
    "Settings": "Einstellungen", "Close Settings": "Einstellungen schließen", "Language & Region": "Sprache & Region",
    "Interface language": "Oberflächensprache", "Campaign language": "Kampagnensprache",
    "Changes Funklix controls and messages.": "Ändert die Bedienelemente und Meldungen in Funklix.",
    "Used for newly generated campaign content.": "Wird für neu generierte Kampagneninhalte verwendet.",
    "🇬🇧 English": "🇬🇧 Englisch", "🇩🇪 German": "🇩🇪 Deutsch", "🇪🇸 Spanish": "🇪🇸 Spanisch",
    "Interface language changes Funklix controls and messages.": "Die Oberflächensprache ändert Funklix-Steuerelemente und Meldungen.",
    "Campaign language is used for newly generated campaign content.": "Die Kampagnensprache wird für neu erstellte Kampagneninhalte verwendet.",
    "Existing Boards and content are not translated automatically.": "Bestehende Boards und Inhalte werden nicht automatisch übersetzt.",
    "Language preferences": "Spracheinstellungen", "Interface language changed.": "Oberflächensprache geändert.",
    "Campaign language changed.": "Kampagnensprache geändert.", "English": "Englisch", "German": "Deutsch", "Spanish": "Spanisch",
    "Appearance": "Erscheinungsbild", "Theme": "Design", "System": "System", "Light": "Hell", "Dark": "Dunkel",
    "Use your device appearance": "Erscheinungsbild des Geräts verwenden", "Light appearance": "Helles Design", "Dark appearance": "Dunkles Design",
    "Change theme": "Design ändern",
    "Node Configuration": "Knotenkonfiguration", "Select or create a node.": "Wähle oder erstelle einen Knoten.",
    "Editing {id}": "{id} bearbeiten", "Basic": "Grundlagen", "Type": "Typ", "Title": "Titel", "Owner": "Zuständig",
    "Node title": "Knotentitel", "Description, prompt, task ...": "Beschreibung, Prompt, Aufgabe ...",
    "Image Prompt": "Bild-Prompt", "Describe the visual style, scene, mood, and composition...": "Beschreibe Bildstil, Szene, Stimmung und Komposition ...",
    "Header visual prompt": "Prompt für das Header-Bild", "Describe the 16:9 hero visual...": "Beschreibe das 16:9-Hero-Bild ...",
    "Generate Header Visual": "Header-Bild erstellen", "Header claim": "Header-Aussage", "Main headline claim": "Kernaussage der Hauptüberschrift",
    "Problem of ICP clearly stated": "Problem der Zielgruppe klar benannt", "Solution for ICP presented": "Lösung für die Zielgruppe dargestellt",
    "Building Trust": "Vertrauen aufbauen", "Call to action for conversion": "Handlungsaufforderung zur Conversion", "Start free trial": "Kostenlos testen",
    "AI Workspace": "KI-Arbeitsbereich", "Platform Preview": "Plattformvorschau", "Caption": "Bildunterschrift", "Social Caption": "Social-Media-Bildunterschrift",
    "Hashtags (comma-separated)": "Hashtags (kommagetrennt)", "Images": "Bilder", "Upload images (Content/Social)": "Bilder hochladen (Content/Social)",
    "Format": "Format", "Generate Image": "Bild erstellen", "Generate Posting Visual": "Posting-Bild erstellen",
    "Audience": "Zielgruppe", "Example: Eco-conscious homeowners": "Beispiel: umweltbewusste Hausbesitzer", "Goal": "Ziel", "Funnel stage": "Funnel-Phase", "Tone": "Tonalität",
    "AI Actions": "KI-Aktionen", "A/B variants (comma-separated)": "A/B-Varianten (kommagetrennt)", "Improve with AI": "Mit KI verbessern",
    "Generate Next Step": "Nächsten Schritt erstellen", "Review Node": "Knoten prüfen", "Regenerate": "Neu erstellen", "Regenerate for platform": "Für Plattform neu erstellen",
    "Add to Posting Calendar": "Zum Posting-Kalender hinzufügen", "Scheduled": "Geplant", "Scheduled: {date} • {time}": "Geplant: {date} • {time}",
    "Generate Full Content Pack": "Vollständiges Content-Paket erstellen", "Node Actions": "Knotenaktionen", "Disconnect node": "Knoten trennen",
    "Disconnect selected": "Auswahl trennen", "Propagate to descendants": "An nachfolgende Knoten übertragen", "Delete node": "Knoten löschen",
    "Delete selected nodes": "Ausgewählte Knoten löschen", "Connected Context": "Verbundener Kontext", "Parents: {count} · Children: {children}": "Eltern: {count} · Kinder: {children}",
    "Parent": "Elternknoten", "Child": "Kindknoten", "No images uploaded.": "Keine Bilder hochgeladen.", "Image preview": "Bildvorschau", "Image": "Bild",
    "Set as favorite": "Als Favorit festlegen", "Download": "Herunterladen", "Delete": "Löschen", "Read-only board": "Board nur zur Ansicht",
    "No next step available": "Kein nächster Schritt verfügbar", "Select a node": "Knoten auswählen", "Review selected node": "Ausgewählten Knoten prüfen",
    "Suggested Fix": "Vorgeschlagene Korrektur", "Target Field": "Zielfeld", "Improvement": "Verbesserung", "Generating suggested fix...": "Vorgeschlagene Korrektur wird erstellt ...",
    "Could not generate a suggested fix.": "Vorgeschlagene Korrektur konnte nicht erstellt werden.", "Dismiss": "Verwerfen", "Explanation": "Erklärung",
    "No explanation provided.": "Keine Erklärung angegeben.", "Apply": "Anwenden", "Current Text": "Aktueller Text", "Suggested Text": "Vorgeschlagener Text",
    "Draft": "Entwurf", "In Review": "In Prüfung", "Needs Changes": "Änderungen erforderlich", "Changes requested": "Änderungen erforderlich", "Approved": "Freigegeben", "Published": "Veröffentlicht", "Submit for review": "Zur Prüfung einreichen", "Request changes": "Änderungen anfordern", "Reopen as Draft": "Als Entwurf öffnen",
    "Idea": "Idee", "Campaign Variation": "Kampagnenvariante", "Social Media Posting": "Social-Media-Posting", "Email Campaign": "E-Mail-Kampagne",
    "Visual Concept": "Visuelles Konzept", "Image Brief": "Bild-Briefing", "Lead Gen": "Leadgenerierung", "Community": "Community", "Education": "Bildung",
    "Campaign Strategy": "Kampagnenstrategie", "Interest": "Interesse", "Consideration": "Erwägung", "Retention": "Bindung",
    "Content Library": "Inhaltsbibliothek", "Search content": "Inhalte durchsuchen", "Asset type": "Inhaltstyp", "Channel / platform": "Kanal / Plattform",
    "Editorial status": "Redaktioneller Status", "Readiness": "Bereitschaft", "Owner": "Zuständig", "Content language": "Inhaltssprache",
    "Clear filters": "Filter löschen", "Ready": "Bereit", "Incomplete": "Unvollständig", "Open Inspector": "Inspector öffnen", "Copy content": "Inhalt kopieren",
    "How readiness is determined": "So wird die Bereitschaft bestimmt", "No assets match these filters.": "Keine Inhalte entsprechen diesen Filtern.",
    "Professional": "Professionell", "Emotional": "Emotional", "Direct": "Direkt", "Premium": "Premium", "Playful": "Verspielt",
    "Awareness": "Bekanntheit", "Conversion": "Conversion", "Collaborator": "Mitwirkende Person", "Current owner": "Aktuell zuständig"
  };
  const dictionaries = Object.freeze({ en: Object.freeze({}), de: Object.freeze(german) });
  const allowed = (value, list, fallback) => list.includes(value) ? value : fallback;
  function restorePreferences(source = storage) {
    try {
      const parsed = JSON.parse(source?.getItem(STORAGE_KEY) || "{}");
      return { uiLanguage: allowed(parsed.uiLanguage, UI_LANGUAGES, DEFAULT_UI_LANGUAGE), campaignLanguage: allowed(parsed.campaignLanguage, CAMPAIGN_LANGUAGES, DEFAULT_CAMPAIGN_LANGUAGE) };
    } catch (_) { return { uiLanguage: DEFAULT_UI_LANGUAGE, campaignLanguage: DEFAULT_CAMPAIGN_LANGUAGE }; }
  }
  let preferences = restorePreferences();
  function persist(source = storage) {
    try { source?.setItem(STORAGE_KEY, JSON.stringify({ uiLanguage: preferences.uiLanguage, campaignLanguage: preferences.campaignLanguage })); } catch (_) { /* optional browser preference */ }
  }
  function setUiLanguage(value) { preferences = { ...preferences, uiLanguage: allowed(value, UI_LANGUAGES, DEFAULT_UI_LANGUAGE) }; persist(); return preferences.uiLanguage; }
  function setCampaignLanguage(value) { preferences = { ...preferences, campaignLanguage: allowed(value, CAMPAIGN_LANGUAGES, DEFAULT_CAMPAIGN_LANGUAGE) }; persist(); return preferences.campaignLanguage; }
  function getPreferences() { return { ...preferences }; }
  function t(key, language = preferences.uiLanguage) { return language === "en" ? key : (dictionaries[language]?.[key] || key); }
  function generationInstruction(language) {
    const safe = allowed(language, CAMPAIGN_LANGUAGES, DEFAULT_CAMPAIGN_LANGUAGE);
    return { id: safe, name: LANGUAGE_NAMES[safe] };
  }
  function applyTranslations(container, language = preferences.uiLanguage) {
    if (!container || !container.querySelectorAll) return;
    const nodes = [container, ...container.querySelectorAll("[data-i18n], [data-i18n-placeholder], [data-i18n-aria-label], [data-i18n-title]")];
    nodes.forEach((node) => {
      const key = node.getAttribute?.("data-i18n");
      const placeholder = node.getAttribute?.("data-i18n-placeholder");
      const ariaLabel = node.getAttribute?.("data-i18n-aria-label");
      const title = node.getAttribute?.("data-i18n-title");
      if (key) node.textContent = t(key, language);
      if (placeholder) node.setAttribute("placeholder", t(placeholder, language));
      if (ariaLabel) node.setAttribute("aria-label", t(ariaLabel, language));
      if (title) node.setAttribute("title", t(title, language));
    });
    if (container.ownerDocument) container.ownerDocument.documentElement.lang = language;
  }
  return Object.freeze({ UI_LANGUAGES, CAMPAIGN_LANGUAGES, DEFAULT_UI_LANGUAGE, DEFAULT_CAMPAIGN_LANGUAGE, STORAGE_KEY, LANGUAGE_NAMES, dictionaries, restorePreferences, getPreferences, setUiLanguage, setCampaignLanguage, t, generationInstruction, applyTranslations });
});
