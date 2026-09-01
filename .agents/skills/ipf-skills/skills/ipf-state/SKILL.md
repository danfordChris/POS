---
name: ipf-state
description: Use when adding or refactoring Provider-based state in this Notify Flutter app. Trigger for feature providers, loading/create/update/delete state, provider registration, screen-to-provider wiring, and replacing dummy data with reactive state.
---

# iPF State

Use this skill for Provider-driven feature state.

## Repo Rules

- Prefer one feature provider per cohesive screen or data domain.
- Register app-wide providers in `lib/shared/providers/providers.dart`.
- Keep UI state close to the feature under `lib/features/<feature>/providers/` when it is not app-global.
- Expose simple read models to widgets; avoid embedding networking or persistence logic directly in screens.
- Keep the current screen runnable with dummy data until the backing service exists.

## Notify Conventions

- The repo standard is Provider with notifiers.
- Shared styling and composition stay in widgets; providers manage fetch/mutation state only.
- When replacing local dummy data, preserve the shared widget APIs.

## When To Read More

- Read `../../../skills/ipf-state.md` when you need the legacy `BaseDataProvider<T>` pattern, state flags, or starter-pack consumption helpers.
