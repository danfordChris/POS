# T-0006 Web App Shell + Login + Auth Guard + Business Switcher

## Status

- `blocked`
- Last updated: 2026-09-01

> **Superseded.** Superseded by decision 0002. Still needed, but targets the `gateway`. Re-scope under Phase 01 before starting.

## Linked Phase

- Phase 00 — Foundations

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/interfaces/web-app-spec.md`, `docs/design/interfaces/api-contract.md`
- Constraints: server-side auth guard per route; API is the only source of truth; all fetches scoped to the selected `business_id`; try/catch in every server action with `error.code`-keyed messages.
- Do not touch: API code; feature screens (catalog/stock/sales/wingers land in later phases).

## Objective

The Next.js app authenticates a user, persists the session, guards routes, and lets a multi-business user switch context, with a placeholder dashboard.

## Scope Boundary

**In scope:**
- `/login`, `/accept-invite?token=` (calls `POST /v1/invitations/accept`), `/` placeholder dashboard.
- Session handling (httpOnly cookie) + transparent token refresh; logout.
- Route guard: unauthenticated → `/login`; Owner-only guard helper returning a 403 page.
- Header business switcher populated from `GET /v1/auth/me`; selection persisted; all data hooks read it.
- i18n scaffold (en/sw) + locale switch.
- API client wrapper mapping the JSON error envelope to typed errors.

**Out of scope:**
- Any feature screen content beyond placeholders.
- Winger UI (Phase 04).

## Acceptance Criteria

- [ ] Visiting any guarded route unauthenticated redirects to `/login`.
- [ ] Successful login sets an httpOnly session cookie and lands on `/`.
- [ ] `/accept-invite` with a valid token joins the business and redirects to `/`; expired token shows a 410 message.
- [ ] A user with 2 businesses sees both in the switcher; switching reloads the dashboard with the new `business_id` and no stale data.
- [ ] Expired access token is refreshed transparently on the next request; refresh failure returns the user to `/login`.
- [ ] Locale switch toggles en/sw copy on the shell.

## Dependencies

- T-0003, T-0004, T-0005

## Implementation Checklist

- [ ] Scaffold routes and layout; wire i18n.
- [ ] Implement session cookie + refresh + logout.
- [ ] Implement auth guard + Owner-only helper + 403 page.
- [ ] Build the API client wrapper with typed errors.
- [ ] Implement the business switcher from `/auth/me`; persist + propagate selection.
- [ ] Implement `/login` and `/accept-invite`.
- [ ] Component/e2e tests for the Acceptance Criteria.

## Verification

- Command: `pnpm --filter web test && pnpm --filter web build`
- Evidence: passing test output + a short screen recording or screenshots of login, switcher, and 403 page in the PR.
