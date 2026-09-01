---
name: ipf-security
description: Use when implementing security-sensitive Flutter changes in this Notify app. Trigger for token handling, secure storage, SSL pinning, signed requests, encrypted database decisions, and environment-secret handling.
---

# iPF Security

Use this skill for security-sensitive implementation decisions.

## Repo Rules

- Keep secrets and tokens out of plain preferences and source-controlled constants.
- Put environment-driven secrets behind `--dart-define`, `.env`, or secure platform storage as appropriate.
- Keep certificate pinning, signing, and encrypted storage decisions centralized.
- Treat auth/session code as shared infrastructure, not feature-local convenience logic.

## Notify Conventions

- The app standard is token-based auth stored in secure storage.
- Sensitive local persistence should prefer encrypted mechanisms.
- Security changes should preserve existing public widget and service APIs when possible.

## When To Read More

- Read `../../../skills/ipf-security.md` when you need the starter-pack SSL pinning, request-signing, encrypted database, or environment helper details.
