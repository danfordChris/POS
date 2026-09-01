---
name: ipf-api
description: Use when adding or refactoring API services in this Notify Flutter app. Trigger for API managers, authenticated requests, response mapping, error handling, multipart uploads, token refresh, and feature services that call backend endpoints.
---

# iPF API

Use this skill for backend integration work.

## Repo Rules

- Put API managers and transport-level concerns in shared or service layers, not screens.
- Keep feature-specific request/response mapping under the owning feature when practical.
- Document unresolved API envelopes in `AGENTS.md` or workflow docs before hard-coding assumptions.
- Map backend failures into user-safe exceptions or error states instead of leaking raw responses into widgets.

## Notify Conventions

- The app standard is an API manager service pattern.
- Tokens belong in secure storage, not plain preferences.
- Preserve the ability to swap dummy data for real services without changing widget contracts.

## When To Read More

- Read `../../../skills/ipf-api.md` when you need the starter-pack `BaseAPIManager`, `StarterAPIManagement`, response helpers, refresh-on-401 handling, or multipart examples.
