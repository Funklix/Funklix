# BW-36.22 current Home evidence

Baseline: `ee9f9ac53401b50f16632a2c13051cb381769383` (merged main, PR #792). Captured 19 October 2026 (Europe/Berlin) with system Chromium, actual application HTML/scripts/styles, and the existing B2 local fixture. All transport was intercepted; provider/AI/analytics requests and Board writes were prohibited. Fixture names/counts already exist in the repository's regression harness and are not production claims or proposed product data.

See the [audit](../bw36-22-home-ux-and-visual-design-audit.md) for findings and design decisions. [Geometry](geometry.json) records eleven current-source configurations with the hero aligned at viewport y=0. Sidebar names below describe requested preference; the existing responsive shell determines actual rail/bottom-nav layout. `System` resolves Dark in this capture. These are local browser observations, not physical-device or screen-reader acceptance.

| Width / mode / language / sidebar preference | Hero-top screenshot |
| --- | --- |
| 1920 Light EN expanded | [View](1920-light-en-expanded.png) |
| 1440 Light EN expanded | [View](1440-light-en-expanded.png) |
| 1440 Dark DE collapsed | [View](1440-dark-de-collapsed.png) |
| 1280 Light DE expanded | [View](1280-light-de-expanded.png) |
| 1024 Dark EN expanded | [View](1024-dark-en-expanded.png) |
| 768 Light EN expanded | [View](768-light-en-expanded.png) |
| 768 System→Dark DE collapsed | [View](768-system-de-collapsed.png) |
| 375 Light EN collapsed | [View](375-light-en-collapsed.png) |
| 375 Dark DE expanded | [View](375-dark-de-expanded.png) |
| 320 Light EN collapsed | [View](320-light-en-collapsed.png) |
| 320 Dark DE expanded | [View](320-dark-de-expanded.png) |

Additional current-source module-position views (900 px viewport height):

- [Desktop Insights](insights-1440-light-en.png), [desktop Brain](brain-1440-light-en.png).
- [Phone Insights](insights-375-dark-de.png), [phone Brain](brain-375-dark-de.png).
- [Supplemental 200% CSS zoom and repeated existing Board-label stress](zoom-200-long-label.png). This is not native browser/text zoom certification.

The scroll owner is the Home region, not the document. A full-page screenshot clips later content and was excluded; section-position images and measured geometry describe the actual complete layout. Top captures visibly show fixed phone navigation/context controls covering lower content, despite zero document horizontal overflow.

[Annotated desktop/mobile proposal](layout-concept.svg) contains only placeholders for existing fields/actions, and is pending approval. The [capture recipe](capture-recipe.md) archives the temporary local harness for reproducibility; no product script, CSS, package, test or CI file changes in this audit.
