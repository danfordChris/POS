# Backlog

## Status

pending

## Objective

Hold work not yet scheduled into a phase or written as a full task doc.

## Implementation Checklist

- [x] Web app shell (ex T-0006) — done as T-0120 (Kong edge, not a `gateway` service)
- [x] Mobile app shell (ex T-0007) — done as T-0121
- [ ] `GET /v1/businesses` — list the caller's memberships → businesses. Needed for the
      client business switcher and to skip forced onboarding for users who already
      belong to a business. tenancy's `membership` RLS is per-business, so this needs a
      SECURITY DEFINER function or an identity→tenancy composition.
- [ ] `GET /v1/auth/me` should compose `memberships` / `wingerAccounts` (identity calls
      tenancy `resolveMembership` / a new list RPC). Currently returns empty arrays.
- [ ] Invitations capability in `services/tenancy` (ex T-0005) — schedule after T-0113
- [ ] Expand Phase 02–06 checklist items into full task docs when each phase is scheduled
- [ ] Service mesh (mTLS) evaluation — Phase 06
- [ ] Invitation resend endpoint
- [ ] CI coverage gates
- [ ] Post-MVP: NextSMS adapter, PDF invoicing, payments/mobile money, multi-location, EFD/VFD, offline sync, push notifications, `reporting`/`media` services
