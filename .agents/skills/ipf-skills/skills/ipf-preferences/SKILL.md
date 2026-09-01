---
name: ipf-preferences
description: Use when adding or refactoring local preference storage in this Notify Flutter app. Trigger for app settings, cached flags, secure token storage, theme or language preferences, and storage abstractions that separate sensitive from non-sensitive values.
---

# iPF Preferences

Use this skill for shared preferences and secure storage work.

## Repo Rules

- Keep non-sensitive user settings in plain preferences.
- Keep session tokens, auth artifacts, and sensitive data in secure storage only.
- Wrap storage access behind small app-specific classes instead of scattering raw key strings.
- Centralize preference keys and access patterns so features remain easy to migrate.

## Notify Conventions

- Language, theme, and simple user settings belong in app preferences.
- Auth/session storage belongs in secure preferences.
- Feature code should consume typed preference helpers, not raw storage calls.

## When To Read More

- Read `../../../skills/ipf-preferences.md` when you need the starter-pack `BasePreferences`, `BaseSecurePreferences`, supported types, or storage API examples.
