# Multi-stage build for the inventory service. Build context = repo root.
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @pos/contracts --filter @pos/nest-common build \
 && pnpm --filter @pos/inventory exec prisma generate \
 && pnpm --filter @pos/inventory build \
 && pnpm --filter @pos/inventory... --prod install

FROM node:24-alpine AS runtime
RUN corepack enable && apk add --no-cache wget
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo /app
WORKDIR /app/services/inventory
EXPOSE 3000
CMD ["node", "dist/main.js"]
