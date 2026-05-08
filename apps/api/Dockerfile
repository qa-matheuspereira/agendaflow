FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.4

FROM base AS builder
RUN npm install -g prisma@6
WORKDIR /app
COPY .npmrc ./
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
RUN pnpm install --frozen-lockfile
COPY . .
RUN PRISMA_GENERATE_SKIP_AUTOINSTALL=1 prisma generate --schema=apps/api/prisma/schema.prisma
RUN pnpm --filter @agendaflow/shared build || true
RUN pnpm --filter @agendaflow/api build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main"]
