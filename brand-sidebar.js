(function (root) {
  "use strict";

  const TEXT = Object.freeze({
    en: Object.freeze({ brand: "Brand", campaign: "Used by this campaign", selected: "Selected Brand", profile: "Brand Profile", open: "Open Brand Profile", change: "Change campaign Brand", switch: "Switch Brand", update: "Update available", review: "Review campaign updates", empty: "No Brand selected", emptyHelp: "Choose a Brand to continue.", legacy: "Campaign Brand", legacyHelp: "Saved with this campaign", unavailable: "Brand unavailable", loading: "Loading Brand…" }),
    de: Object.freeze({ brand: "Marke", campaign: "Für diese Kampagne verwendet", selected: "Ausgewählte Marke", profile: "Markenprofil", open: "Markenprofil öffnen", change: "Kampagnenmarke ändern", switch: "Marke wechseln", update: "Aktualisierung verfügbar", review: "Kampagnen-Updates prüfen", empty: "Keine Marke ausgewählt", emptyHelp: "Wähle eine Marke aus, um fortzufahren.", legacy: "Kampagnenmarke", legacyHelp: "Mit dieser Kampagne gespeichert", unavailable: "Marke nicht verfügbar", loading: "Marke wird geladen…" })
  });

  function project(input = {}) {
    const text = TEXT[input.language === "de" ? "de" : "en"];
    const catalog = Array.isArray(input.catalog) ? input.catalog : [];
    const authorized = (id) => catalog.find((brand) => brand.id === id) || null;
    if (input.loading) return { kind: "loading", title: text.loading, supporting: "", text, reusable: false };
    if (input.accessDenied) return { kind: "unavailable", title: text.unavailable, supporting: "", text, reusable: false };
    if (input.brandMode && input.viewedBrandId) {
      const brand = authorized(input.viewedBrandId);
      if (brand) return identity("profile", brand, text.profile, text, input);
      return { kind: "unavailable", title: text.unavailable, supporting: "", text, reusable: false };
    }
    if (input.hasBoard) {
      if (input.boardBrandId) {
        const brand = authorized(input.boardBrandId);
        if (brand) return identity("campaign", brand, text.campaign, text, input);
        return { kind: "unavailable", title: text.unavailable, supporting: "", text, reusable: false };
      }
      if (input.hasLegacySnapshot) return { kind: "legacy", title: text.legacy, supporting: text.legacyHelp, text, reusable: false, hasBoard: true };
      return { kind: "empty", title: text.empty, supporting: text.emptyHelp, text, reusable: false, hasBoard: true };
    }
    const selected = authorized(input.selectedBrandId);
    return selected ? identity("selected", selected, text.selected, text, input) : { kind: "empty", title: text.empty, supporting: text.emptyHelp, text, reusable: false, hasBoard: false };
  }

  function identity(kind, brand, relationship, text, input) {
    return { kind, id: brand.id, title: String(brand.name || "").trim(), logo_url: brand.logo_url || null, supporting: relationship, text, reusable: true, hasBoard: !!input.hasBoard, canChange: input.canChange === true, updateAvailable: input.updateAvailable === true, role: brand.role || "viewer" };
  }

  function initials(name) {
    const parts = Array.from(String(name || "").trim().split(/\s+/).filter(Boolean));
    return (parts.slice(0, 2).map((part) => Array.from(part)[0] || "").join("") || "B").toLocaleUpperCase();
  }

  function avatarUrl(brandCore) {
    const avatar = brandCore?.brandDNA?.avatar;
    const value = avatar?.userApproved === true ? String(avatar.imageUrl || "").trim() : "";
    return /^(https:\/\/|blob:|data:image\/)/i.test(value) ? value : "";
  }

  function render(elements, model, options = {}) {
    const { panel, avatar, name, note, status, open, change } = elements;
    if (!panel || !avatar || !name || !note) return;
    panel.dataset.brandState = model.kind;
    panel.setAttribute("aria-busy", model.kind === "loading" ? "true" : "false");
    name.textContent = model.title;
    name.title = model.title;
    note.textContent = model.supporting;
    avatar.replaceChildren();
    if (model.reusable && model.logo_url && root.FunklixBrandLogo) root.FunklixBrandLogo.render(avatar, { name: model.title, logo_url: model.logo_url });
    const url = model.reusable && !model.logo_url ? avatarUrl(options.brandCore) : "";
    const fallback = () => {
      avatar.replaceChildren();
      const mark = avatar.ownerDocument.createElement("span");
      mark.textContent = initials(model.title);
      mark.setAttribute("aria-hidden", "true");
      avatar.append(mark);
    };
    avatar.setAttribute("aria-label", model.reusable ? `${model.title} Brand` : model.title);
    if (model.logo_url && root.FunklixBrandLogo) { /* shared helper already rendered it */ }
    else if (url) {
      const image = avatar.ownerDocument.createElement("img");
      image.src = url;
      image.alt = `${model.title} Brand`;
      image.addEventListener("error", fallback, { once: true });
      avatar.append(image);
    } else fallback();
    if (status) {
      status.textContent = model.updateAvailable ? model.text.update : "";
      status.classList.toggle("hidden", !model.updateAvailable);
    }
    if (open) {
      open.textContent = model.text.open;
      open.hidden = !model.reusable;
      open.disabled = !model.reusable;
    }
    if (change) {
      change.textContent = model.hasBoard ? model.text.change : model.text.switch;
      change.hidden = model.hasBoard ? !model.canChange : false;
      change.disabled = model.hasBoard ? !model.canChange : false;
    }
  }

  const api = Object.freeze({ TEXT, project, initials, avatarUrl, render });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BrandSidebar = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
