FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.4

FROM base AS builder
RUN npm install -g @nestjs/cli typescript@5.7.3 prisma@6
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
RUN pnpm install --frozen-lockfile
COPY . .
RUN prisma generate --schema=apps/api/prisma/schema.prisma
RUN pnpm --filter @agendaflow/shared build || true
RUN pnpm --filter @agendaflow/api build

FROM node:20-alpine AS runner
RUN npm install -g pnpm@9.15.4
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
