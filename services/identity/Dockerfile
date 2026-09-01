# Multi-stage build for the identity service. Build context = repo root.
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @pos/contracts --filter @pos/nest-common build \
 && pnpm --filter @pos/identity exec prisma generate \
 && pnpm --filter @pos/identity build \
 && pnpm --filter @pos/identity... --prod install

FROM node:24-alpine AS runtime
RUN corepack enable && apk add --no-cache wget
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo /app
WORKDIR /app/services/identity
EXPOSE 3000
CMD ["node", "dist/main.js"]
