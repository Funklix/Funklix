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
    "Interface language": "Oberflächensprache", "Campaign language": "Kampagnensprache",
    "Interface language changes Funklix controls and messages.": "Die Oberflächensprache ändert Funklix-Steuerelemente und Meldungen.",
    "Campaign language is used for newly generated campaign content.": "Die Kampagnensprache wird für neu erstellte Kampagneninhalte verwendet.",
    "Existing Boards and content are not translated automatically.": "Bestehende Boards und Inhalte werden nicht automatisch übersetzt.",
    "Language preferences": "Spracheinstellungen", "Interface language changed.": "Oberflächensprache geändert.",
    "Campaign language changed.": "Kampagnensprache geändert.", "English": "Englisch", "German": "Deutsch", "Spanish": "Spanisch"
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
    const nodes = [container, ...container.querySelectorAll("[data-i18n], [data-i18n-placeholder]")];
    nodes.forEach((node) => {
      const key = node.getAttribute?.("data-i18n");
      const placeholder = node.getAttribute?.("data-i18n-placeholder");
      if (key) node.textContent = t(key, language);
      if (placeholder) node.setAttribute("placeholder", t(placeholder, language));
    });
    if (container.ownerDocument) container.ownerDocument.documentElement.lang = language;
  }
  return Object.freeze({ UI_LANGUAGES, CAMPAIGN_LANGUAGES, DEFAULT_UI_LANGUAGE, DEFAULT_CAMPAIGN_LANGUAGE, STORAGE_KEY, LANGUAGE_NAMES, dictionaries, restorePreferences, getPreferences, setUiLanguage, setCampaignLanguage, t, generationInstruction, applyTranslations });
});
