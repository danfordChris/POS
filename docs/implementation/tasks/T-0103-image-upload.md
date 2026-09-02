# T-0103 Catalog Service — Product Image Upload

## Status

- `done`
- Last updated: 2026-09-02

## Linked Phase

- Phase 02 — Inventory Core

## Agent Context

- Skills: backend, workflow-contract
- Design docs: `docs/design/interfaces/api-contract.md` (`POST /businesses/{businessId}/products/{id}/image`), `docs/design/integrations/README.md`
- Constraints: object storage is S3-compatible (MinIO local, per `infra/docker-compose.yml`); the adapter never leaks S3 error detail to the client — it returns the canonical envelope with a safe `message` + technical `devMessage`; wrap the upload in try/catch; only JPEG/PNG/WebP; size-capped.
- Do not touch: identity/tenancy; the stock/inventory service.

## Objective

`POST /v1/businesses/{businessId}/products/{id}/image` accepts a multipart image, stores it in the S3-compatible bucket under a per-business/per-product key, sets `product.image_url`, and re-emits `ProductUpserted`.

## Scope Boundary

**In scope:**
- `services/catalog/src/media/media.service.ts` — `S3Client` (`@aws-sdk/client-s3`), `uploadProductImage`, MIME allow-list.
- `services/catalog/src/catalog/products.controller.ts` — `uploadImage` handler with `FileInterceptor('image')`, validation (present / size / MIME), existence check, then store + `setProductImage`.
- `services/catalog/src/config/env.ts` — `S3_*`, `S3_PUBLIC_URL`, `IMAGE_MAX_BYTES`.
- `.env.example`, `infra/docker-compose.yml` (`catalog` S3 env + `minio` dependency), `infra/k8s/base/secret.example.yaml` (`S3_*`).

**Out of scope:**
- Image resizing / thumbnails / CDN (backlog).
- A dedicated `media` service (deferred — see `docs/implementation/project.md`).

## Acceptance Criteria

- `POST .../products/{id}/image` with a PNG/JPEG/WebP part named `image` returns the updated product view with a non-null `image_url` pointing at `S3_PUBLIC_URL/...`.
- Missing `image` part → 400 `validation_error` (`details[].field == "image"`).
- A part over `IMAGE_MAX_BYTES` → 400 `validation_error` (`issue == "too_large"`).
- A non-image MIME → 400 `validation_error`.
- Unknown product id → 404 `not_found` before any bytes are stored.
- An S3 failure surfaces as 503 `upstream_unavailable` with a generic `message`, never a raw S3 error.
- `pnpm --filter @pos/catalog build` + `lint` clean.

## Dependencies

- T-0101, T-0102

## Implementation Checklist

1. Add `@aws-sdk/client-s3` to `@pos/catalog`; extend `env.ts` with `S3_*` / `IMAGE_MAX_BYTES`.
2. `MediaService.uploadProductImage(businessId, productId, buffer, contentType)` → `{ url, key }`, try/catch → 503 envelope.
3. Controller `uploadImage`: validate presence/size/MIME → assert product exists → `media.uploadProductImage` → `catalog.setProductImage`.
4. Compose + k8s secret env for S3.
5. Build + lint.

## Verification

- `pnpm --filter @pos/catalog build` + `pnpm --filter @pos/catalog lint` clean.
- Handler validation paths (missing / too-large / bad-MIME / unknown-product) covered by branch logic in `products.controller.ts`; the S3 failure path returns the `upstream_unavailable` envelope from `media.service.ts`.
- `docker compose config -q` valid with the new `catalog` S3 env + `minio` dependency.
- Manual local smoke deferred to the Phase 02 live end-to-end pass (Kong → catalog → MinIO) recorded in `docs/implementation/status/weekly-status.md`.
