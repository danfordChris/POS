# Product Brand Name — "Stoki"

## Status

proposed

## Context

- `docs/design/product/` never assigned the platform a brand name; it is described
  only as "the platform" / "multi-tenant stock management platform".
- "Duka Stock" appeared incidentally in the vendored design handoff
  (`docs/design/interfaces/design_handoff_neumorphic_system/`), `ui-design-system.md`,
  a few token file headers, and as the hardcoded mobile window title / login wordmark.
- 2026-09-06: the mobile client was changed to display **"Stoki"** via
  `mobile/lib/core/app_info.dart` (`AppInfo.name`) — window title, login wordmark,
  Android label, iOS `CFBundleName` / `CFBundleDisplayName`, pubspec description
  (commit `b9e7175`). The web client still shows no explicit brand.

## Problem

- The product now ships a user-facing brand name that no design doc has adopted.
- Two names are live in the tree ("Stoki" in the mobile app, "Duka Stock" in the
  design handoff bundle and `ui-design-system.md`).

## Proposed Change

- Confirm **"Stoki"** as the product brand name, or choose an alternative.
- On acceptance:
  - Add the name to `docs/design/product/overview.md`.
  - Update `docs/design/interfaces/ui-design-system.md` and the token file headers
    under `design_handoff_neumorphic_system/` from "Duka Stock" to the chosen name
    (the `.dc.html` handoff reference may be left as a dated snapshot).
  - Apply the name to the web client (title, header, metadata) to match mobile.

## Expected Design Impact

- One line in `docs/design/product/overview.md`; string-only edits to
  `ui-design-system.md` and the handoff token headers.

## Expected Implementation Impact

- Web client: title / header / metadata string change to match `AppInfo.name`.
- Mobile client: none — already implemented.
