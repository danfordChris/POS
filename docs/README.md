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
- `design/architecture/system-overview.md` — services, request/data flow, environments
- `design/architecture/service-decomposition.md` — context map, ownership, transport, data, deployment
- `design/architecture/multi-tenancy.md` — tenant model, 5 isolation layers, break-glass policy

### Data
- `design/data/data-model.md` — entities, invariants, indexes

### Interfaces
- `design/interfaces/api-contract.md` — the `gateway`'s public REST contract, auth, error model
- `design/interfaces/events-catalog.md` — NATS domain events (subjects, payloads, consumers)
- `design/interfaces/internal-rpc.md` — synchronous inter-service calls + internal context
- `design/interfaces/mobile-app-spec.md` — Flutter app screens and behaviors
- `design/interfaces/web-app-spec.md` — Next.js admin routes and behaviors

### Integrations
- `design/integrations/README.md` — external dependency inventory
- `design/integrations/notifications.md` — email events, low-stock rules

### Decisions
- `design/decisions/0001-foundational-choices.md` — stack, tenancy, market, deferrals
- `design/decisions/0002-microservices.md` — service split, NATS, database-per-service, Kubernetes
