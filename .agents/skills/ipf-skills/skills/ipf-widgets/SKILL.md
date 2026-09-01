---
name: ipf-widgets
description: Use when building or extending reusable Flutter widgets in this Notify app. Trigger for shared cards, app bars, inputs, lists, layout shells, section widgets, and any work that should reuse or extend existing `lib/shared/widgets/repo` components safely.
---

# iPF Widgets

Use this skill for shared or feature-scoped widget work.

## Repo Rules

- Reuse `lib/shared/widgets/repo/` first. Extend via props, variants, or composition before duplicating styles.
- Keep screen-specific composition under `lib/features/<feature>/widgets/`.
- Use `Theme.of(context)`, `AppColors`, `AppSpacing`, and `AppTextTheme` for visual consistency.
- Keep widget APIs backwards-compatible when existing screens already use them.
- Add only minimal comments where the code would otherwise be hard to parse.

## Notify Conventions

- Shared card language belongs in `AppCard` and related shared primitives.
- Layout shells, navigation bars, and app bars should stay reusable across authenticated screens.
- Avoid hardcoded screen-only styling inside shared widgets.

## When To Read More

- Read `../../../skills/ipf-widgets.md` when you need the older starter-pack widget inventory, abstract base widget patterns, or splash/offline wrappers.
