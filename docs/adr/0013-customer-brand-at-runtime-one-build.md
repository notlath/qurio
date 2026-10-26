---
status: accepted
---

# A Customer's Brand arrives at runtime, in the one shared build

Customers want the app to carry their company's Brand. We keep one build on the public stores and apply each Customer's Brand at runtime. The Brand is a logo and one main colour for each of light and dark. The app name and home-screen icon stay Qurio. A Customer that needs its own name and icon gets a White-label Build under a paid agreement, by private distribution.

MTC hosts one Brand file per Customer as a static file, next to the Client ID Metadata Document, keyed by tenant hostname. The file holds the Customer's name, the logo and the two colours. The logo is a PNG with a transparent background, with an optional second PNG for dark mode. Each tenant hostname has its own file, so no file lists MTC's Customers. A Tenant alias gets a copy of the file when the Customer asks. The app reads it as soon as it knows the tenant hostname, so the sign-in screen carries the Brand colour too.

This keeps [ADR-0003](0003-single-multi-tenant-app.md): one codebase and one build serve every Customer, and no code path names a Customer. It amends [ADR-0001](0001-per-user-native-oauth-no-backend.md): the app now reads a hosted file. There is still no server and no secret.

## Considered options

- **Give each Customer the code, or a white-label build for each.** Rejected as the default. It is the only way to change the name and icon, but MTC then maintains one build per Customer. Apple also rejects near-identical copies of one app on the public store (App Store Review Guideline 4.3). Kept as a paid exception.
- **A Settings screen where each Qlik User picks colours.** Rejected. That is a personal preference, not the Customer's Brand, and the Customer cannot control it.
- **Qlik's Tenant Brand** (`GET /api/v1/brands/active`). The Customer's admin would set the logo once, with no MTC work. Rejected for now: it holds `logo`, `favIcon` and `styles` files but no colour, it is readable only after sign-in, and nobody has checked that a non-admin can read it. On `mtcai.sg` it returned `{}` (2026-10-23). Revisit if Customers want to change their Brand themselves.
- **MDM only, or MDM as a second source.** No hosting, but a Customer without MDM gets no Brand, and two sources can disagree. The hosted file already brands the sign-in screen. Add MDM only if a Customer's network cannot reach the hosted file.
- **One file that lists every Customer's Brand.** One request, but it publishes every Customer's tenant hostname.

## Consequences

- Until the Qlik User enters a tenant hostname, the app shows Qurio's Brand. A tenant hostname with no Brand file also gets Qurio's Brand.
- The Brand shows where the Qurio logo and the `primary` colour show today. The logo replaces the Qurio logo in the side-panel header and on the chat welcome. The sign-in screen has no logo, so there it shows only the colour. The splash screen and the icon are compiled in and stay Qurio.
- The Customer supplies one main colour per theme. The app computes the text colour on it. If the colour fails WCAG contrast (3:1 against the background, 4.5:1 with its text), the app uses Qurio blue. Fonts, spacing and radii stay ours.
- The backgrounds, borders and secondary text take the hue of the Brand colour, so Qurio blue never shows next to another hue. Their saturation and lightness stay Qurio's, which keeps every text pair at WCAG AA at any hue.
- The file can also hold a `mark`: the logo's symbol with no text. The side-panel header shows the mark, because the logo's text is too small to read there. Without a mark, it shows the logo.
- The app keeps the last Brand for each Tenant on the device, shows it at once on launch, and refreshes it in the background. It removes the Brand when the Qlik User removes the Tenant. A Brand is not Answer content, so [ADR-0007](0007-no-answer-content-on-device.md) does not apply.
- Each new Customer's Brand is one file that MTC adds. The files share the beta GitHub Pages address and its release gate (ADR-0012).
