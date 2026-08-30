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
    "Content Workspace": "Content-Arbeitsbereich", "Board Brand Core": "Board Brand Core",
    "AI Brain": "KI-Brain", "Insights": "Einblicke", "Activity": "Aktivität",
    "AI Insights": "KI-Einblicke", "Measured performance": "Gemessene Performance",
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
    "Draft": "Entwurf", "In Review": "In Prüfung", "Needs Changes": "Änderungen nötig", "Approved": "Freigegeben", "Published": "Veröffentlicht",
    "Idea": "Idee", "Campaign Variation": "Kampagnenvariante", "Social Media Posting": "Social-Media-Posting", "Email Campaign": "E-Mail-Kampagne",
    "Visual Concept": "Visuelles Konzept", "Image Brief": "Bild-Briefing", "Lead Gen": "Leadgenerierung", "Community": "Community", "Education": "Bildung",
    "Campaign Strategy": "Kampagnenstrategie", "Interest": "Interesse", "Consideration": "Erwägung", "Retention": "Bindung",
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
