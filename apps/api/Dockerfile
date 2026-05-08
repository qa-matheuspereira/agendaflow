FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.4

FROM base AS builder
RUN npm install -g @nestjs/cli@10
WORKDIR /app

# 1. Copiar manifests do workspace (cache layer)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
RUN echo "node-linker=hoisted" > .npmrc && \
    NODE_ENV=development pnpm install --frozen-lockfile --ignore-scripts

# 2. Copiar código fonte
COPY . .

# 3. Build do pacote shared PRIMEIRO (sem || true — falha explícita)
RUN cd packages/shared && npx tsc --project tsconfig.json

# 4. Verificar build do shared
RUN test -s packages/shared/dist/index.js || \
    (echo "ERRO: packages/shared/dist/index.js está vazio ou não existe" && exit 1)
RUN test -s packages/shared/dist/enums/index.js || \
    (echo "ERRO: packages/shared/dist/enums/index.js está vazio ou não existe" && exit 1)

# 5. Gerar Prisma Client
RUN node_modules/.bin/prisma generate --schema=apps/api/prisma/schema.prisma

# 6. Build da API
RUN cd apps/api && nest build

# ─── Runner image ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Artefatos compilados da API
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

# node_modules hoisted (inclui @agendaflow/shared symlink resolvido)
COPY --from=builder /app/node_modules ./node_modules

# Shared compilado — necessário porque o dist da API faz require relativo
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json

# Substituir symlink pnpm por cópia real com estrutura correta:
# package.json diz "main": "./dist/index.js" → dist/ deve ser subpasta
RUN rm -rf node_modules/@agendaflow/shared && \
    mkdir -p node_modules/@agendaflow/shared/dist && \
    cp -r /app/packages/shared/dist/. node_modules/@agendaflow/shared/dist/ && \
    cp /app/packages/shared/package.json node_modules/@agendaflow/shared/package.json

EXPOSE 3001

CMD ["sh", "-c", "node_modules/.bin/prisma db push --schema apps/api/prisma/schema.prisma --accept-data-loss && node apps/api/dist/main"]
