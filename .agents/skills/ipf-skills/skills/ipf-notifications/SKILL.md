---
name: ipf-notifications
description: Use when adding notification behavior to this Notify Flutter app. Trigger for local notifications, scheduled reminders, notification payload routing, startup registration, or future messaging-related hooks.
---

# iPF Notifications

Use this skill for app notification work.

## Repo Rules

- Keep notification service registration in app startup code, not feature screens.
- Route notification tap behavior through navigation-safe handlers.
- Keep payload parsing explicit and versionable.
- Do not couple notification delivery logic directly to presentation widgets.

## Notify Conventions

- The app standard expects notification initialization during `main()` setup.
- Feature flows should consume notification intents through providers or coordinators where possible.

## When To Read More

- Read `../../../skills/ipf-notifications.md` when you need the starter-pack `BaseNotificationService`, scheduling examples, or notification tap callback patterns.
