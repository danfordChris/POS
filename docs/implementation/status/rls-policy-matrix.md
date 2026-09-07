# RLS Policy Matrix (T-0504)

Every tenant table in every service. `strict` = the `tenant_isolation` policy from
`enable_tenant_rls(...)` (an unset / empty `app.business_id` reads **zero** rows).
`relaxed-read` = an added policy that also allows reads when `app.business_id` is
unset — always because one code path legitimately reads with no tenant context;
`WITH CHECK` on every one of these stays strict, so cross-tenant **writes** are
still rejected. `none` = not a tenant table (no `business_id`).

Verified by `services/<svc>/test/rls-backstop.e2e-spec.ts` (raw SQL, app filter
bypassed): strict tables → 0 rows for an unset and a foreign `app.business_id`;
relaxed tables → rows visible unscoped but 0 for a foreign id; every table →
a cross-tenant INSERT is rejected.

| Service | Table | Policy | Relaxed because |
|---|---|---|---|
| catalog | `category` | strict | — |
| catalog | `product` | strict | — |
| inventory | `stock_item` | strict | — |
| inventory | `stock_movement` | strict | — |
| inventory | `low_stock_alert_state` | strict | — |
| inventory | `stock_reservation` | strict | — |
| inventory | `alert_config` | strict | — |
| sales | `sale_number_counter` | strict | — |
| sales | `invoice_number_counter` | strict | — |
| sales | `product_cache` | strict | — |
| sales | `customer` | strict | — |
| sales | `payment` | strict | — |
| sales | `sale` | relaxed-read | public `GET /v1/r/{token}` renders a receipt with no tenant context (migration `20260907140000`) |
| sales | `sale_line` | relaxed-read | same public receipt path |
| sales | `receipt` | relaxed-read | same public receipt path |
| sales | `invoice` | relaxed-read | public `GET /v1/i/{token}` renders an invoice with no tenant context (migration `20260907160000`) |
| sales | `invoice_line` | relaxed-read | same public invoice path (migration `20260907170000`) |
| sales | `sales_business` | none | projection; no `business_id` scoping |
| media | `document` | relaxed-read | public `GET /v1/i/{token}/pdf` looks the row up by `public_token` with no tenant context (migration `20260908160000`) |
| winger | `winger_catalog_projection` | strict | — |
| winger | `winger_account` | relaxed-read | `GET /v1/winger/businesses` lists a user's grants cross-business (migration `20260908130000`) |
| winger | `winger_business` | none | projection |
| tenancy | `business` | strict + `control_plane_read` (SELECT-only) | operator `GET /v1/admin/businesses` lists id/name/status/counts (migration `20260908150000`) |
| tenancy | `membership` | strict + `control_plane_read` (SELECT-only) | same control-plane list (member counts) |
| tenancy | `invitation` | relaxed-read | `POST /v1/invitations/accept` looks it up by unique `token_hash` with no business context (migration `20260908140000`) |
| tenancy | `support_access_grant` | relaxed-read | operator lists their own grants across businesses (migration `20260908150000`) |
| tenancy | `audit_log` | relaxed-read | operator/Owner reads the trail; `WITH CHECK` also allows a null `business_id` for control-plane rows |
| notifications | `notification_contact` | strict | — |
| notifications | `notification` | relaxed-read | the send worker scans `queued` rows across all tenants (migration `20260906150000`) |
| notifications | `notification_business` | none | projection |
| notifications | `digest_config` | none | internal worker config |
| notifications | `overdue_invoice` | none | internal worker projection for the overdue sweep (migration `20260908170000`) |

Every service also has `outbox` + `processed_events` — internal, no tenant column.
