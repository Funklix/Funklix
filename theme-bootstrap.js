(function () {
  "use strict";
  var key = "funklix.themePreference.v1";
  var preference = "system";
  try {
    var stored = localStorage.getItem(key);
    if (stored === "light" || stored === "dark" || stored === "system") preference = stored;
  } catch (_) { /* Browser storage is an optional enhancement. */ }
  var dark = false;
  try { dark = preference === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (_) { /* Light is the safe fallback. */ }
  document.documentElement.dataset.theme = preference === "dark" || dark ? "dark" : "light";
  document.documentElement.style.colorScheme = document.documentElement.dataset.theme;
})();
