---
name: ipf-extensions
description: Use when a Flutter change in this Notify app would benefit from reusable extensions rather than repeated inline logic. Trigger for formatting helpers, BuildContext accessors, safe-area helpers, collection helpers, and shared value transforms.
---

# iPF Extensions

Use this skill when repeated widget or model code should become an extension.

## Repo Rules

- Add extensions under `lib/core/extensions/`.
- Prefer extension helpers only when they remove clear repetition or encode a stable convention.
- Keep extensions small, deterministic, and free of hidden side effects.
- Do not add project-specific business logic to generic type extensions.

## Notify Conventions

- `BuildContext` helpers are already in active use for theme, dimensions, and safe-area behavior.
- Prefer explicit utility methods over clever chaining when readability would suffer.

## When To Read More

- Read `../../../skills/ipf-extensions.md` when you need the starter-pack extension inventory or exact helper names that may already exist upstream.
