(function (root) {
  "use strict";
  // Presentation-only binding. The existing Brain renderer owns lifetime and scope.
  function bind(view, isCurrent) {
    const viewport = root.visualViewport;
    if (!view || !viewport) return () => {};
    const fit = () => {
      if (!isCurrent()) return;
      view.classList.toggle("ai-brain-compact-viewport", viewport.height <= 640);
      const sidebar = view.ownerDocument.querySelector(".sidebar");
      const bottomInset = sidebar && root.getComputedStyle(sidebar).position === "fixed" ? sidebar.getBoundingClientRect().height : 0;
      view.style.maxHeight = `${Math.max(160, viewport.height + viewport.offsetTop - view.getBoundingClientRect().top - bottomInset)}px`;
    };
    viewport.addEventListener("resize", fit);
    viewport.addEventListener("scroll", fit);
    fit();
    return () => {
      viewport.removeEventListener("resize", fit);
      viewport.removeEventListener("scroll", fit);
      view.style.maxHeight = "";
      view.classList.remove("ai-brain-compact-viewport");
    };
  }
  root.FunklixAiBrainViewport = Object.freeze({ bind });
})(typeof window !== "undefined" ? window : globalThis);
