# Multi-stage build for the winger service. Build context = repo root.
FROM node:24-alpine AS build
RUN corepack enable
ENV CI=true HUSKY=0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @pos/contracts --filter @pos/nest-common build \
 && pnpm --filter @pos/winger exec prisma generate \
 && pnpm --filter @pos/winger build \
 && pnpm --filter @pos/winger... --prod --ignore-scripts install

FROM node:24-alpine AS runtime
RUN corepack enable && apk add --no-cache wget
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo /app
WORKDIR /app/services/winger
EXPOSE 3000
CMD ["node", "dist/main.js"]
