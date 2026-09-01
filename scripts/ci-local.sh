#!/usr/bin/env bash
# Runs the same gates as .github/workflows/ci.yml against the local docker-compose
# stack. Requires: docker compose up -d, and .env populated (cp .env.example .env).
set -euo pipefail
cd "$(dirname "$0")/.."

set -a; [ -f .env ] && . ./.env; set +a

say() { printf '\n\033[1;36m== %s ==\033[0m\n' "$1"; }

say "install"
pnpm install --frozen-lockfile

say "shared packages: build + test + lint"
pnpm --filter @pos/contracts --filter @pos/nest-common --filter @pos/testing build
pnpm --filter @pos/contracts --filter @pos/nest-common --filter @pos/testing test
pnpm -r lint

say "contracts backward-compat"
node scripts/check-contracts-compat.mjs "$(git rev-parse HEAD~1 2>/dev/null || echo HEAD)"

say "migrate per service"
( cd services/identity && pnpm exec prisma migrate deploy )
( cd services/tenancy  && pnpm exec prisma migrate deploy )

say "service tests + build"
pnpm -r --if-present test
pnpm -r build

say "format"
pnpm format:check

say "kong config parse"
docker run --rm -e KONG_DATABASE=off -e KONG_PLUGINS=bundled,pos-internal-context \
  -e JWT_ACCESS_SECRET=x -e INTERNAL_CONTEXT_SECRET=x -e INTERNAL_API_KEY=x \
  -v "$PWD/infra/kong/kong.yml:/kong/kong.yml:ro" \
  -v "$PWD/infra/kong/plugins/pos-internal-context:/usr/local/share/lua/5.1/kong/plugins/pos-internal-context:ro" \
  kong:3.7 kong config parse /kong/kong.yml

say "k8s render"
kubectl kustomize infra/k8s/base > /dev/null && echo "kustomize OK"

say "workflow docs"
python3 .agents/workflows/workflow-contract/scripts/validate_workflow.py

echo
echo "ci-local: all gates passed"
