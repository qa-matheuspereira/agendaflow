# AgendaFlow SaaS — Arquitetura Técnica Completa
# FASE 1 | 2026-04-30

## Stack Definitiva

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Frontend | Next.js 14 (App Router) + TypeScript | SSR + RSC para SEO do painel |
| UI | Tailwind CSS + Shadcn UI | Design system produtivo, acessível |
| Backend | NestJS + TypeScript | Módular, DI nativa, decorators, guards |
| ORM | Prisma | Type-safe, migrations versionadas |
| Banco | PostgreSQL 15 | Robustez, JSONB, índices compostos |
| Cache/Queue | Redis + BullMQ | Filas de notificação, cache de estado |
| Auth | JWT (RS256) + Passport | Stateless, multi-tenant seguro |
| WhatsApp | Evolution API v2 | Webhook-based, multi-instance |
| Pagamento | Mercado Pago API | Pix nativo, cobertura Brasil |
| Deploy FE | Vercel | CI/CD automático, edge network |
| Deploy BE | Railway | PostgreSQL + Redis + NestJS no mesmo projeto |
| Automações | n8n (self-hosted Railway) | Webhook-ready, sem vendor lock-in |

## Estrutura de Módulos NestJS

```
src/
├── main.ts
├── app.module.ts
│
├── core/                          # Infraestrutura transversal
│   ├── database/                  # PrismaService + PrismaModule
│   ├── redis/                     # RedisModule (ioredis)
│   ├── guards/                    # TenantGuard, RolesGuard, JwtGuard
│   ├── decorators/                # @CurrentUser, @CurrentTenant, @Roles
│   ├── interceptors/              # TenantInjector, AuditLog, Transform
│   ├── filters/                   # GlobalExceptionFilter
│   ├── pipes/                     # ValidationPipe global
│   └── config/                    # ConfigModule (env vars tipadas)
│
├── auth/                          # Autenticação e Autorização
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/                # JwtStrategy, LocalStrategy
│   └── dto/
│
├── companies/                     # Gestão de tenants
│   ├── companies.module.ts
│   ├── companies.controller.ts
│   ├── companies.service.ts
│   └── dto/
│
├── users/                         # Usuários do painel web
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── dto/
│
├── collaborators/                 # Colaboradores (WhatsApp operadores)
│   ├── collaborators.module.ts
│   ├── collaborators.controller.ts
│   ├── collaborators.service.ts
│   └── dto/
│
├── clients/                       # Clientes
│   ├── clients.module.ts
│   ├── clients.controller.ts
│   ├── clients.service.ts
│   └── dto/
│
├── services/                      # Serviços oferecidos
│   ├── services.module.ts
│   ├── services.controller.ts
│   ├── services.service.ts
│   └── dto/
│
├── schedule/                      # Motor de agendamento
│   ├── schedule.module.ts
│   ├── schedule.controller.ts
│   ├── schedule.service.ts
│   ├── schedule-engine.service.ts # Lógica de slots disponíveis
│   ├── schedule-rules.service.ts  # Validação de regras de negócio
│   └── dto/
│
├── queue/                         # Fila de atendimento
│   ├── queue.module.ts
│   ├── queue.controller.ts
│   ├── queue.service.ts
│   ├── queue.gateway.ts           # Socket.io WebSocket gateway
│   └── dto/
│
├── business-hours/                # Horários e pausas
│   ├── business-hours.module.ts
│   ├── business-hours.controller.ts
│   ├── business-hours.service.ts
│   └── dto/
│
├── payments/                      # Mercado Pago
│   ├── payments.module.ts
│   ├── payments.controller.ts
│   ├── payments.service.ts
│   ├── mercadopago.service.ts     # Wrapper MP SDK
│   └── dto/
│
├── whatsapp/                      # WhatsApp Engine
│   ├── whatsapp.module.ts
│   ├── whatsapp.controller.ts     # Webhook receiver
│   ├── whatsapp.service.ts        # Sender (Evolution API)
│   ├── bot/
│   │   ├── client-bot.service.ts       # State machine cliente
│   │   ├── collaborator-bot.service.ts # Handler colaborador
│   │   ├── conversation-state.service.ts
│   │   └── steps/                      # Cada step da conversa
│   │       ├── greeting.step.ts
│   │       ├── select-service.step.ts
│   │       ├── select-collaborator.step.ts
│   │       ├── select-date.step.ts
│   │       ├── select-time.step.ts
│   │       ├── confirm-appointment.step.ts
│   │       ├── cancel-appointment.step.ts
│   │       ├── reschedule.step.ts
│   │       ├── queue-join.step.ts
│   │       └── queue-position.step.ts
│   └── templates/                 # Templates de mensagem
│       ├── client.templates.ts
│       └── collaborator.templates.ts
│
├── notifications/                 # Notificações (BullMQ consumers)
│   ├── notifications.module.ts
│   ├── notifications.service.ts
│   ├── notification-scheduler.service.ts  # Cron de lembretes
│   └── processors/
│       ├── whatsapp-notification.processor.ts
│       └── payment-notification.processor.ts
│
├── reports/                       # Relatórios e KPIs
│   ├── reports.module.ts
│   ├── reports.controller.ts
│   ├── reports.service.ts
│   └── dto/
│
├── settings/                      # Configurações por tenant
│   ├── settings.module.ts
│   ├── settings.controller.ts
│   ├── settings.service.ts
│   └── dto/
│
└── audit/                         # Auditoria
    ├── audit.module.ts
    └── audit.service.ts
```

## Estrutura de Módulos Next.js (App Router)

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
│
├── (dashboard)/
│   ├── layout.tsx                 # DashboardLayout com Sidebar
│   ├── page.tsx                   # KPIs Overview
│   ├── appointments/
│   │   ├── page.tsx               # Lista + filtros
│   │   ├── new/page.tsx
│   │   └── [id]/page.tsx
│   ├── queue/
│   │   └── page.tsx               # Fila em tempo real (WebSocket)
│   ├── collaborators/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [id]/page.tsx
│   ├── clients/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── services/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── schedule/
│   │   └── page.tsx               # Grade de horários visual
│   ├── reports/
│   │   └── page.tsx
│   └── settings/
│       ├── page.tsx               # Configurações gerais
│       ├── whatsapp/page.tsx
│       ├── payments/page.tsx
│       └── rules/page.tsx
│
└── api/
    └── [...]/                     # Proxy routes se necessário
```

## Fluxo de Tenant Isolation

```
Request HTTP
    │
    ▼
JwtAuthGuard (valida token JWT)
    │
    ▼
TenantGuard (extrai company_id do token)
    │
    ▼
TenantInterceptor (injeta company_id em todo PrismaService)
    │
    ▼
Controller → Service → PrismaService
                           │
                           ▼
                   WHERE company_id = :tenantId
                   (NUNCA omitir este filtro)
```

## Arquitetura de Notificações (BullMQ)

```
Evento de negócio (ex: agendamento criado)
    │
    ▼
NotificationsService.enqueue(job)
    │
    ▼
BullMQ Queue: 'whatsapp-notifications'
    │
    ▼
WhatsappNotificationProcessor.process(job)
    │
    ├── Busca template configurado pelo tenant
    ├── Interpola variáveis (nome, data, hora, etc.)
    └── WhatsappService.sendMessage(instanceName, number, message)
              │
              ▼
        Evolution API REST
              │
              ▼
        WhatsApp do cliente/colaborador
```

## Estratégia de State Machine (Bot WhatsApp Cliente)

```
Estados possíveis:
IDLE → MAIN_MENU → [
  BOOKING_SELECT_SERVICE
    → BOOKING_SELECT_COLLABORATOR (opcional, se empresa configurar)
    → BOOKING_SELECT_DATE
    → BOOKING_SELECT_TIME
    → BOOKING_CONFIRM (+ upload documento se exigido)
    → BOOKING_PAYMENT (se pagamento antecipado)
    → DONE_BOOKING
  CANCEL_LIST_APPOINTMENTS
    → CANCEL_CONFIRM
    → DONE_CANCEL
  RESCHEDULE_SELECT_APPOINTMENT
    → RESCHEDULE_SELECT_DATE
    → RESCHEDULE_SELECT_TIME
    → RESCHEDULE_CONFIRM
    → DONE_RESCHEDULE
  QUEUE_JOIN
    → QUEUE_SELECT_SERVICE (opcional)
    → QUEUE_CONFIRM
    → DONE_QUEUE
  QUEUE_POSITION
    → SHOW_POSITION
]

Cada estado tem:
- handler: processa mensagem atual
- render: gera mensagem de resposta
- timeout: em inatividade, volta para IDLE com mensagem

ConversationState é persistido no PostgreSQL com TTL.
```

## Pontos de Integração n8n

```
n8n pode disparar via webhook para:
POST /webhooks/n8n/trigger-notification   → envia mensagem customizada
POST /webhooks/n8n/create-appointment     → cria agendamento programático
POST /webhooks/n8n/update-queue-position  → manipula fila

n8n recebe eventos de:
POST {n8n_webhook_url}/appointment-created
POST {n8n_webhook_url}/appointment-completed
POST {n8n_webhook_url}/payment-confirmed
POST {n8n_webhook_url}/client-blocked
```

## Decisões Arquiteturais Críticas

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Multi-tenant | Row-level (shared schema) | Custo operacional menor, migrations simples |
| State machine WhatsApp | PostgreSQL (não Redis) | Durabilidade, histórico, debug |
| WebSocket fila | Socket.io via NestJS | Integração nativa, rooms por tenant |
| Queue de notificações | BullMQ + Redis | Retry automático, prioridades, dead letter |
| Auth | JWT RS256 stateless | Sem session store, escalável horizontalmente |
| Evolution API | Webhook mode | Não ocupa CPU com polling |
| Mercado Pago | Checkout Pro + Webhook | Suporte a todos os métodos, notificação segura |
