# infra/k8s

Kubernetes manifests for the POS platform. `base/` is a plain
[kustomize](https://kustomize.io/) overlay; environment overlays (staging,
production) layer on top.

## Layout

| Path | Contents |
|---|---|
| `base/` | namespace, shared ConfigMap, example Secret, NetworkPolicies, single-node NATS/JetStream, and `gateway` / `identity` / `tenancy` (Deployment + Service + HPA + PDB; Ingress for `gateway`) |
| `examples/service.template.yaml` | starting point for a new domain service — copy to `base/<svc>.yaml` and add it to `base/kustomization.yaml` |

## Render / apply

```bash
# render (also what CI checks)
kubectl kustomize infra/k8s/base

# apply to the current context
kubectl apply -k infra/k8s/base
```

## Conventions

- Every workload label: `app.kubernetes.io/name: <svc>`, `app.kubernetes.io/part-of: pos-platform`.
- Each service exposes `/healthz` (liveness) and `/readyz` (readiness incl. DB + NATS).
- Config via `envFrom` the `pos-shared` ConfigMap + `pos-secrets` Secret. **`secret.example.yaml` is a placeholder** — real values come from the cluster secret manager (sealed-secrets / external-secrets / SOPS).
- Only `gateway` has an Ingress. `default-deny-ingress` + `allow-ingress-to-gateway` + `allow-intra-namespace` keep every other service private.
- One shared PostgreSQL instance (not deployed here — managed): one schema + non-superuser role per service, wired via the `*_DATABASE_URL` secrets.

## Production overlay TODO

- Replace `base/nats.yaml` with the upstream NATS Helm chart (3-node cluster, file storage, auth).
- Add `resources`/limits tuning, topology spread, PodMonitor/ServiceMonitor, and an mTLS decision (service mesh vs. NetworkPolicy — Phase 06).
