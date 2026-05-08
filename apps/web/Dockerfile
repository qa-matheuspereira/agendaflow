FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.4

# ─── Deps ─────────────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
RUN echo "node-linker=hoisted" > .npmrc && \
    pnpm install --frozen-lockfile --ignore-scripts

# ─── Builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build shared (sem || true — falha explícita)
RUN cd packages/shared && npx tsc --project tsconfig.json
RUN test -s packages/shared/dist/index.js || \
    (echo "ERRO: shared/dist/index.js está vazio" && exit 1)

# Build Next.js (recebe URL da API como build arg)
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @agendaflow/web build

# ─── Runner ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
