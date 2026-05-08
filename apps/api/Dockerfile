FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.4

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm install --frozen-lockfile --ignore-scripts
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

CMD ["sh", "-c", "node -e \"const {execSync}=require('child_process');try{execSync('npx prisma generate',{stdio:'inherit'})}catch(e){}try{execSync('npx prisma migrate deploy',{stdio:'inherit'})}catch(e){}\" && node dist/main"]
