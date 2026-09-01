# Documentation Map

## Canonical Workflow Policy

- `.agents/workflows/workflow-contract/spec/*`

## Layers

- `docs/changes/proposed/` — unresolved proposals only.
- `docs/design/` — approved product / system truth.
- `docs/implementation/` — execution plan: project, phases, tasks, status.

## Design Index

### Product
- `design/product/overview.md` — vision, personas, success metrics
- `design/product/prd-mvp.md` — MVP requirements, user stories, acceptance criteria
- `design/product/roles-and-permissions.md` — role matrix, winger + operator rules

### Architecture
- `design/architecture/system-overview.md` — components, request/data flow
- `design/architecture/multi-tenancy.md` — tenant model, isolation layers, break-glass policy

### Data
- `design/data/data-model.md` — entities, invariants, indexes

### Interfaces
- `design/interfaces/api-contract.md` — REST endpoints, auth, error model
- `design/interfaces/mobile-app-spec.md` — Flutter app screens and behaviors
- `design/interfaces/web-app-spec.md` — Next.js admin routes and behaviors

### Integrations
- `design/integrations/README.md` — external dependency inventory
- `design/integrations/notifications.md` — email events, low-stock rules

### Decisions
- `design/decisions/0001-foundational-choices.md` — stack, tenancy, market, deferrals
