# Multi-stage build for the catalog service. Build context = repo root.
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @pos/contracts --filter @pos/nest-common build \
 && pnpm --filter @pos/catalog exec prisma generate \
 && pnpm --filter @pos/catalog build \
 && pnpm --filter @pos/catalog... --prod install

FROM node:24-alpine AS runtime
RUN corepack enable && apk add --no-cache wget
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo /app
WORKDIR /app/services/catalog
EXPOSE 3000
CMD ["node", "dist/main.js"]
