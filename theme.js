(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FunklixTheme = api;
})(typeof window !== "undefined" ? window : null, function (root) {
  "use strict";
  var STORAGE_KEY = "funklix.themePreference.v1";
  var VALID_PREFERENCES = Object.freeze(["system", "light", "dark"]);
  var DEFAULT_PREFERENCE = "system";
  var preference = readStoredPreference();
  var mediaQuery = null;

  function validatePreference(value) { return VALID_PREFERENCES.includes(value) ? value : DEFAULT_PREFERENCE; }
  function readStoredPreference(storage) {
    try { return validatePreference((storage || root?.localStorage)?.getItem(STORAGE_KEY)); }
    catch (_) { return DEFAULT_PREFERENCE; }
  }
  function resolveTheme(value, matchesDark) {
    var safe = validatePreference(value);
    if (safe !== "system") return safe;
    if (typeof matchesDark === "boolean") return matchesDark ? "dark" : "light";
    try { return root?.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
    catch (_) { return "light"; }
  }
  function applyTheme(value) {
    var resolvedTheme = resolveTheme(value);
    if (root?.document?.documentElement) {
      root.document.documentElement.dataset.theme = resolvedTheme;
      root.document.documentElement.style.colorScheme = resolvedTheme;
    }
    return resolvedTheme;
  }
  function persistPreference(value, storage) {
    try { (storage || root?.localStorage)?.setItem(STORAGE_KEY, value); } catch (_) { /* Keep the session theme active. */ }
  }
  function emitChange() {
    var detail = getState();
    try { root?.dispatchEvent?.(new CustomEvent("funklix:themechange", { detail: detail })); } catch (_) { /* Older harnesses may not expose CustomEvent. */ }
    return detail;
  }
  function setPreference(value) {
    preference = validatePreference(value);
    persistPreference(preference);
    applyTheme(preference);
    syncControls();
    return emitChange();
  }
  function getState() { return { themePreference: preference, resolvedTheme: resolveTheme(preference) }; }
  function labels() {
    var de = root?.document?.documentElement?.lang === "de";
    return de
      ? { change: "Design ändern", system: "System", light: "Hell", dark: "Dunkel" }
      : { change: "Change theme", system: "System", light: "Light", dark: "Dark" };
  }
  function closeMenu(options) {
    var menu = root?.document?.getElementById("theme-quick-menu");
    var button = root?.document?.getElementById("theme-quick-button");
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    button?.setAttribute("aria-expanded", "false");
    if (options?.focus) button?.focus();
  }
  function syncControls() {
    var copy = labels();
    var select = root?.document?.getElementById("theme-preference-select");
    var button = root?.document?.getElementById("theme-quick-button");
    if (select) select.value = preference;
    if (button) { button.setAttribute("aria-label", copy.change); button.title = copy.change; }
    root?.document?.querySelectorAll?.("[data-theme-choice]").forEach(function (item) {
      var selected = item.dataset.themeChoice === preference;
      item.setAttribute("aria-checked", String(selected));
      item.classList.toggle("is-selected", selected);
    });
  }
  function bindControls() {
    var doc = root?.document;
    if (!doc) return;
    var select = doc.getElementById("theme-preference-select");
    var button = doc.getElementById("theme-quick-button");
    var menu = doc.getElementById("theme-quick-menu");
    select?.addEventListener("change", function () { setPreference(select.value); });
    button?.addEventListener("click", function () {
      var opening = menu?.hidden;
      if (!menu) return;
      menu.hidden = !opening;
      button.setAttribute("aria-expanded", String(opening));
      if (opening) menu.querySelector("[aria-checked='true']")?.focus();
    });
    menu?.addEventListener("click", function (event) {
      var choice = event.target.closest("[data-theme-choice]");
      if (!choice) return;
      setPreference(choice.dataset.themeChoice);
      closeMenu({ focus: true });
    });
    doc.addEventListener("click", function (event) {
      if (!event.target.closest("#theme-quick-control")) closeMenu();
    });
    doc.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && menu && !menu.hidden) { event.preventDefault(); closeMenu({ focus: true }); }
    });
    syncControls();
  }
  function onSystemChange() { if (preference === "system") { applyTheme(preference); syncControls(); emitChange(); } }
  function init() {
    applyTheme(preference);
    try {
      mediaQuery = root?.matchMedia?.("(prefers-color-scheme: dark)") || null;
      mediaQuery?.addEventListener?.("change", onSystemChange);
      mediaQuery?.addListener?.(onSystemChange);
    } catch (_) { mediaQuery = null; }
    if (root?.document?.readyState === "loading") root.document.addEventListener("DOMContentLoaded", bindControls, { once: true });
    else bindControls();
    return getState();
  }
  return Object.freeze({ STORAGE_KEY: STORAGE_KEY, VALID_PREFERENCES: VALID_PREFERENCES, DEFAULT_PREFERENCE: DEFAULT_PREFERENCE, validatePreference: validatePreference, readStoredPreference: readStoredPreference, resolveTheme: resolveTheme, applyTheme: applyTheme, setPreference: setPreference, getState: getState, syncControls: syncControls, closeMenu: closeMenu, init: init });
});

if (typeof window !== "undefined") window.FunklixTheme?.init();
