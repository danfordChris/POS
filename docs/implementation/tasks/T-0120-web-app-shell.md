# T-0120 Web — App Shell (auth, session, navigation)

## Status

- `done`
- Last updated: 2026-09-02

## Linked Phase

- Phase 02 — Inventory Core (client foundation; unblocks T-0109)

## Agent Context

- Skills: workflow-contract
- Design docs: `docs/design/interfaces/web-app-spec.md`, `docs/design/interfaces/api-contract.md`, `docs/design/interfaces/ui-design-system.md`
- Constraints: the browser never holds a token — auth lives in httpOnly cookies set by route handlers; the Next 16 proxy (middleware) refreshes the access token against Kong before expiry; every API failure surfaces via the error-by-code component; server-side route + role guards; no hard-coded colors (neumorphic kit only).
- Do not touch: `services/*`, `mobile/`.

## Objective

`web/` boots into a real authenticated shell: sign in / register / create-business against Kong, a 232px sidebar + header with role-gated navigation, and themed placeholders for the feature routes.

## Scope Boundary

**In scope:**
- `lib/api.ts` (typed Kong client + `ApiError`), `lib/auth.ts` + `auth-edge.ts` (cookie helpers), `lib/session.ts` (`getSession`), `lib/nav.ts`.
- `proxy.ts` — route gate + transparent access-token refresh.
- Route handlers: `/api/auth/{login,register,logout}`, `/api/businesses`.
- `(auth)` login + register, `/onboarding` create-business.
- `(shell)` layout (`Sidebar`, `Header`, `BusinessSwitcher`, `SignOutButton`), dashboard, and stub pages for `catalog`, `stock`, `stock/movements`, `sales` (member) and `members`, `wingers`, `alerts`, `reports`, `settings`, `support` (Owner-only → `Forbidden` for Staff).
- Gallery moved to `/style`. `deps`: `lucide-react`, `server-only`. `API_BASE_URL` → Kong.

**Out of scope:**
- Any data view (catalog table, stock, etc.) — T-0109.
- Multi-business switching — blocked on a `GET /v1/businesses` list endpoint (backlog).
- Accept-invite flow — depends on tenancy invitations (backlog).

## Acceptance Criteria

- An unauthenticated request to any non-public route redirects to `/login`; visiting `/login` while signed in redirects to `/`.
- Sign-in posts to `/api/auth/login`, which calls Kong and sets httpOnly `duka_at` / `duka_rt` / `duka_at_exp` cookies; the browser response body carries no token.
- The proxy refreshes the access token against `POST /v1/auth/refresh` when it is missing or within 60s of expiry, and clears cookies + redirects to `/login` when refresh fails.
- A signed-in user with no active business is sent to `/onboarding`; creating a business sets `duka_biz` + `duka_role` and lands on `/`.
- The sidebar hides the "Manage" (Owner-only) items for a Staff role; Owner-only pages render `Forbidden` for Staff.
- `pnpm --filter web lint` and `pnpm --filter web build` pass with no hydration mismatch on the theme toggle.

## Dependencies

- T-0114 (Kong), T-0112 (identity auth), T-0113 (tenancy businesses + `role` echo), T-0118 (design system)

## Implementation Checklist

1. `lib/api.ts`, `lib/auth*.ts`, `lib/session.ts`, `lib/nav.ts`.
2. `proxy.ts` gate + refresh; `config.matcher` excludes `_next`, `/api`, assets.
3. Route handlers for auth + business creation.
4. `(auth)` + `/onboarding` screens on the neumorphic kit.
5. `(shell)` layout + components + dashboard + stubs; `Forbidden` for Owner-only.
6. Move gallery to `/style`; make the theme provider SSR-deterministic.
7. `pnpm --filter web lint && build`.

## Verification

- `pnpm --filter web lint` clean; `pnpm --filter web build` succeeds (all routes compile; Proxy active).
- `curl -sI localhost:<port>/` → `location: /login` when unauthenticated.
- Login / `/style` render with the neumorphic styling in the browser; theme SSR selects "Auto" deterministically (no hydration warning).
- Live auth (login → onboarding → shell) exercised against `docker compose up` (Kong + identity + tenancy).
