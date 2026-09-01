# Multi-stage build for the identity service (pnpm workspace).
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Workspace manifests first for a cached install layer.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/nest-common/package.json packages/nest-common/
COPY packages/testing/package.json packages/testing/
COPY services/identity/package.json services/identity/
RUN pnpm install --frozen-lockfile --filter @pos/identity...
# Sources
COPY tsconfig.base.json ./
COPY packages ./packages
COPY services/identity ./services/identity
RUN pnpm --filter @pos/contracts --filter @pos/nest-common build \
 && pnpm --filter @pos/identity exec prisma generate \
 && pnpm --filter @pos/identity build \
 && pnpm deploy --filter @pos/identity --prod /app

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app ./
COPY --from=build /repo/services/identity/generated ./generated
EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
