# Multi-stage build for the media service. Build context = repo root.
FROM node:24-alpine AS build
RUN corepack enable
ENV CI=true HUSKY=0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @pos/contracts --filter @pos/nest-common build \
 && pnpm --filter @pos/media exec prisma generate \
 && pnpm --filter @pos/media build \
 && pnpm --filter @pos/media... --prod --ignore-scripts install

FROM node:24-alpine AS runtime
RUN corepack enable && apk add --no-cache wget
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo /app
WORKDIR /app/services/media
EXPOSE 3000
CMD ["node", "dist/main.js"]
