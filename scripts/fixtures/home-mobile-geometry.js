'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');

// Exercise layout immediately after each change, before a frame/timer can hide
// an interpolated scroll viewport. Then check every Home action against the
// actual scroll clip, fixed overlays and browser hit testing.
module.exports = async function mobileGeometry(page, out) {
  const evidence = [];
  for (const width of [375, 320]) for (const theme of ['light', 'dark']) for (const language of ['en', 'de']) {
    const height = width === 375 ? 812 : 740;
    await page.setViewportSize({ width, height });
    for (const reducedMotion of ['reduce', 'no-preference']) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion });
      // Repeated collapse/expand is intentional: the previous gap and viewport
      // height must never survive a new layout, even within the same task.
      for (const collapsed of [false, true, false, true]) {
        const scenario = { width, height, theme, language, reducedMotion, collapsed };
        const immediate = await page.evaluate(scenario => {
          FunklixTheme.setPreference(scenario.theme);
          FunklixLanguage.setUiLanguage(scenario.language); state.uiLanguage = scenario.language;
          setSidebarCollapsed(scenario.collapsed); refreshDashboardIfVisible(); clearAutosaveTimer();
          const rect = e => e.getBoundingClientRect().toJSON();
          const dashboard = document.querySelector('#dashboard-view');
          const overlays = [...document.querySelectorAll('.sidebar, .sidebar > .workspace-context')]
            .filter(e => getComputedStyle(e).position === 'fixed' && e.getClientRects().length)
            .map(e => ({ selector: e.className, ...rect(e) }));
          return { dashboard: rect(dashboard), overlays, style: dashboard.style.cssText };
        }, scenario);
        const label = JSON.stringify(scenario);
        assert(immediate.overlays.length >= 2, 'Both fixed mobile navigation and context must be measured: ' + label);
        for (const overlay of immediate.overlays)
          assert(immediate.dashboard.bottom <= overlay.top, 'Immediate Home scroll viewport overlaps fixed controls: ' + JSON.stringify({ scenario, ...immediate }));
        const reachability = await page.evaluate(() => {
          const dashboard = document.querySelector('#dashboard-view'), host = document.querySelector('#home-foundation');
          const rect = e => e.getBoundingClientRect().toJSON();
          const overlays = [...document.querySelectorAll('.sidebar, .sidebar > .workspace-context')]
            .filter(e => getComputedStyle(e).position === 'fixed' && e.getClientRects().length).map(rect);
          const overlaps = (a, b) => a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
          return [...host.querySelectorAll('button,select,a[href],[tabindex]')]
            .filter(e => !e.disabled && e.tabIndex >= 0 && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
            .map(e => {
              e.focus(); e.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
              const target = rect(e), viewport = rect(dashboard);
              const hit = document.elementFromPoint((target.left + target.right) / 2, (target.top + target.bottom) / 2);
              return { action: e.dataset.homeFocus || e.id || e.textContent.trim(), target, viewport,
                focused: document.activeElement === e,
                inside: target.top >= viewport.top && target.bottom <= viewport.bottom && target.left >= viewport.left && target.right <= viewport.right,
                collision: overlays.some(overlay => overlaps(target, overlay)), hit: !!hit && (hit === e || e.contains(hit)) };
            });
        });
        assert(reachability.length > 20, 'Full Living Workspace and detailed Home controls must be checked: ' + label);
        assert.deepEqual(reachability.filter(r => !r.focused || !r.inside || r.collision || !r.hit), [], 'Home action is obscured or cannot be focused: ' + label);
        // Native keyboard movement must also keep the next target in the clip.
        await page.locator('#home-workspace-select').focus();
        await page.keyboard.press('Tab');
        const keyboard = await page.evaluate(() => {
          const e = document.activeElement, r = e.getBoundingClientRect(), d = document.querySelector('#dashboard-view').getBoundingClientRect();
          const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
          return { inHome: document.querySelector('#home-foundation').contains(e), inside: r.top >= d.top && r.bottom <= d.bottom, hit: !!hit && (hit === e || e.contains(hit)) };
        });
        assert.deepEqual(keyboard, { inHome: true, inside: true, hit: true }, 'Native Tab target is obscured: ' + label);
        evidence.push({ ...scenario, immediate, reachability, keyboard });
      }
    }
    const nativeCount = await page.evaluate(() => {
      const controls = [...document.querySelectorAll('#home-foundation button,#home-foundation select,#home-foundation a[href],#home-foundation [tabindex]')]
        .filter(e => !e.disabled && e.tabIndex >= 0 && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
      controls[0].focus(); return controls.length;
    });
    const nativeKeyboard = [];
    for (let i = 0; i < nativeCount; i++) {
      if (i) await page.keyboard.press('Tab');
      const target = await page.evaluate(() => {
        const e = document.activeElement, r = e.getBoundingClientRect(), d = document.querySelector('#dashboard-view').getBoundingClientRect();
        const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
        return { action: e.dataset.homeFocus || e.id || e.textContent.trim(), inHome: document.querySelector('#home-foundation').contains(e),
          inside: r.top >= d.top && r.bottom <= d.bottom && r.left >= d.left && r.right <= d.right,
          hit: !!hit && (hit === e || e.contains(hit)) };
      });
      assert(target.inHome && target.inside && target.hit, 'Native Tab sequence is obscured: ' + JSON.stringify({ width, theme, language, target }));
      nativeKeyboard.push(target);
    }
    evidence[evidence.length - 1].nativeKeyboard = nativeKeyboard;
    await page.locator('.home-hero').evaluate(e => e.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.screenshot({ path: path.join(out, `mobile-${width}-${theme}-${language}-collapsed.png`) });
    await page.evaluate(() => { setSidebarCollapsed(false); refreshDashboardIfVisible(); });
    await page.screenshot({ path: path.join(out, `mobile-${width}-${theme}-${language}-expanded.png`) });
    if ((width === 375 && theme === 'light' && language === 'en') || (width === 320 && theme === 'dark' && language === 'de')) {
      for (const [name, target] of [['brain', page.locator('[data-home-action=stage-brain]')], ['details', page.locator('.home-brand-card button').last()]]) {
        await target.focus(); await target.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await page.screenshot({ path: path.join(out, `mobile-${width}-${theme}-${language}-${name}-focused.png`) });
      }
    }
  }
  fs.writeFileSync(path.join(out, 'mobile-geometry.json'), JSON.stringify(evidence, null, 2));
  return evidence;
};
