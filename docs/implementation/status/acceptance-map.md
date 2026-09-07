# MVP Acceptance — PRD Story → Test Map

Every PRD story (`docs/design/product/prd-mvp.md`, U1–U13) plus the Phase 07
invoicing walk-through (U14/U15) maps to at least one automated assertion. All of these run in CI via the `service` job matrix in
`.github/workflows/ci.yml` (each service's `pnpm test` runs `src/**/*.spec.ts` +
`test/**/*.e2e-spec.ts`).

| ID | Story | Asserting test(s) |
|---|---|---|
| U1 | Sign up a business → 201 + Owner membership | `services/tenancy/test/tenancy.e2e-spec.ts` — "creates the business + owner membership and emits BusinessCreated + MembershipCreated" |
| U2 | Owner invites staff → 201 with token; expires per config | `services/tenancy/test/invitations.e2e-spec.ts` — "Owner creates an invitation; response has no token; InvitationCreated carries one" |
| U3 | Invitee joins; expired/used token → 410 | `services/tenancy/test/invitations.e2e-spec.ts` — "an invitee accepts the token → Staff membership; a second accept → 410", "an expired invitation → accept returns 410 …" |
| U4 | Staff adds a product; scoped to the business only | `services/catalog/test/catalog.e2e-spec.ts` (create + role-aware DTO) + `services/catalog/test/isolation.e2e-spec.ts` (cross-tenant 403) |
| U5 | Staff records stock-in; on-hand += qty; one `stock_in` movement | `services/inventory/test/inventory.e2e-spec.ts` (stock-in path) |
| U6 | Scan: known code → product; unknown → 404 with the code | `services/catalog/test/catalog.e2e-spec.ts` (find-by-code) |
| U7 | Movement crossing threshold enqueues exactly one `low_stock` | `services/inventory/test/alert-config.e2e-spec.ts` + `services/notifications/test/low-stock.e2e-spec.ts` |
| U8 | Staff completes a sale; on-hand decreases; receipt URL → 200 anon | `services/sales/test/sales.e2e-spec.ts` (createSale saga) + `services/sales/test/sales.e2e-spec.ts` (public `/v1/r/{token}`) |
| U9 | Void a sale; on-hand restored; receipt void | `services/sales/test/sales.e2e-spec.ts` (void) + `services/inventory` `sale-voided` reversal spec |
| U10 | Owner authorizes a winger → 201; that user can call the winger catalog | `services/winger/test/winger-accounts.e2e-spec.ts` + `services/winger/test/winger-catalog.e2e-spec.ts` |
| U11 | Winger catalog: name/price/in-stock only; no quantity/cost/member fields | `services/winger/test/winger-catalog.e2e-spec.ts` — "GET products returns ONLY the whitelist keys" |
| U12 | Winger probes another business → 403 | `services/winger/test/winger-catalog.e2e-spec.ts` — "non-authorized business_id → 403 winger_scope_denied"; `services/winger/test/isolation.e2e-spec.ts` |
| U13 | Operator on any tenant data route → 403; access only under an audited, ≤24h grant | `services/{catalog,inventory,sales,winger,tenancy}/test/isolation.e2e-spec.ts` (operator → 403 on every route) + `services/tenancy/test/control-plane.e2e-spec.ts` (grant lifecycle: no-grant 403 → approve ≤24h → audited read → revoke/expire 403) |
| U14 | Credit sale issues an `issued` invoice (balance == total, per-business number); public `GET /v1/i/{token}` + rendered PDF | `services/sales/test/invoices.e2e-spec.ts` (credit sale → one `issued` invoice, `customer_required`, whitelist, counter concurrency) + `services/media/test/invoice-pdf.e2e-spec.ts` (render + store + `InvoiceDocumentReady`, `/pdf` `202`→`302`) + `acceptance` job → `infra/acceptance-smoke.sh` U14 |
| U15 | Payments settle the balance (`partially_paid` → `paid`), customer balance follows, overpayment → 422, paid invoice → 409 | `services/sales/test/invoice-payments.e2e-spec.ts` (partial → paid, overpayment, not-payable, idempotency, invariant fuzz, sale-void → invoice-void) + `acceptance` job → `infra/acceptance-smoke.sh` U15 |

## Cross-tenant isolation suite (T-0503, extended by T-0609)

`services/{catalog,inventory,sales,winger,tenancy,media}/test/isolation.e2e-spec.ts`
enumerate every `/v1/businesses/{id}/*` route and assert, per route:

- a signed `user` context for a **different** business → `403`;
- an `operator`-audience context → `403 operator_data_access_denied`;
- a `user` context with no role / no membership → `403`;
- a positive control: the correct member/owner context is **not** blocked by the guard.

`/v1/winger/*` additionally: a non-winger and a **suspended** winger both get
`403 winger_scope_denied` on `…/products`; `/v1/winger/businesses` returns `[]`
(no leak) for a non-winger and `403` for an operator.

Phase 07 adds `/v1/businesses/{id}/customers*` + `/v1/businesses/{id}/invoices*`
(+ `/payments`, `/void`) to the `sales` isolation spec, and the member
`/v1/businesses/{id}/invoices/{id}/pdf` route to a new `services/media`
isolation spec.
