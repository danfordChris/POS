---
name: ipf-setup
description: Use when implementing or refactoring Flutter feature modules in this Notify app, especially when wiring screens, routes, shared widgets, theme usage, or starter-pack structure. Trigger for dashboard work, app shell changes, route composition, and feature-first module setup.
---

# iPF Setup

Use this skill for feature-level Flutter implementation in this repository.

## Repo Rules

- Start with `AGENTS.md`, then validate workflow and read `docs/design/` plus `docs/implementation/`.
- Keep the feature-based structure: `lib/features/<feature>/{screens,widgets,data,providers,services,models}`.
- Reuse shared primitives from `lib/shared/widgets/repo/` before adding new ones.
- Route screen entry points through `lib/core/router/router.dart`.
- Keep theme tokens centralized in `lib/core/theme/`; do not spread hardcoded design tokens across feature files.

## Notify Conventions

- State management is Provider with notifiers.
- Navigation is Go Router.
- Shared app-wide providers live in `lib/shared/providers/`.
- Starter-pack usage should fit the existing repo surface instead of assuming a fresh scaffold.

## When To Read More

- Read `../../../skills/ipf-setup.md` when you need the older starter-pack bootstrap details, dependency guidance, or initialization commands.
