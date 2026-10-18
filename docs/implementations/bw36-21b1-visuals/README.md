# B1 browser evidence

Production application DOM/scripts/styles rendered in real Chromium against intercepted, disposable fixtures. Selected Brand Y and loaded Board Autumn Launch / Brand X deliberately differ. No production data, SQL or paid provider requests are used.

| Viewport | Appearance | Evidence |
| --- | --- | --- |
| 1440px | Light, English | [Home modules](home-1440-light-en.png) |
| 1440px | Dark, German | [Home modules](home-1440-dark-de.png) |
| 375px | Light, English | [Brand Intelligence](home-375-light-en.png), [Team Responsibilities](team-375-light-en.png) |
| 320px | Dark, German | [Brand Intelligence](home-320-dark-de.png), [Team Responsibilities](team-320-dark-de.png) |
| 768px | System (dark), German | [Brand Intelligence](home-768-system-de.png), [Team Responsibilities](team-768-system-de.png) |

`geometry.json` records viewport widths and actual module dimensions/overflow checks. `validation.json` records complete local Runtime Boot Safety validation blocks; its setup entries disclose the use of installed dependencies and system Chromium rather than repeating CI's browser installer. These fixtures do not establish production or physical-device acceptance.
