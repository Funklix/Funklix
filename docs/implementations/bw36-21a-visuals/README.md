# BW-36.21A visual review

Real Chromium captures of the production application with deterministic local authorized Workspace/Brand/Board fixtures. These are UI evidence, not production campaign activity. Existing shell/navigation/context controls remain visible. Mobile Board captures scroll the existing dashboard container.

| View | Capture |
| --- | --- |
| Desktop, light, EN | [1440px Home](home-1440-light-en.png) |
| Desktop, dark, DE | [1440px Home](home-1440-dark-de.png) |
| Mobile, light, EN | [375px Home](home-375-light-en.png) · [Board section](boards-375-light-en.png) |
| Mobile, dark, DE | [320px Home](home-320-dark-de.png) · [Board section](boards-320-dark-de.png) |

[Measured layout geometry and accent-text contrast](geometry.json) include system theme at 768px and 200% text at 720px. No tested Home descendant exceeded the viewport width. Reduced motion was enabled. Native keyboard/focus and accessible labels are covered by the focused suite; no manual screen-reader or physical-device session is claimed.

[Runtime Boot Safety and focused-check results](validation.json).
