# AgendaFlow SaaS — Árvore de Pastas Completa
# FASE 1 | 2026-04-30

```
agendamento-saas/
│
├── .planning/                         # Documentação de arquitetura (não vai para produção)
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.prisma
│   ├── FLOWS.md
│   ├── FOLDER_STRUCTURE.md
│   └── FAILURE_POINTS.md
│
├── apps/
│   ├── api/                           # NestJS Backend
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   │
│   │   │   ├── core/
│   │   │   │   ├── database/
│   │   │   │   │   ├── prisma.service.ts
│   │   │   │   │   └── prisma.module.ts
│   │   │   │   ├── redis/
│   │   │   │   │   ├── redis.service.ts
│   │   │   │   │   └── redis.module.ts
│   │   │   │   ├── guards/
│   │   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   │   ├── tenant.guard.ts
│   │   │   │   │   └── roles.guard.ts
│   │   │   │   ├── decorators/
│   │   │   │   │   ├── current-user.decorator.ts
│   │   │   │   │   ├── current-tenant.decorator.ts
│   │   │   │   │   └── roles.decorator.ts
│   │   │   │   ├── interceptors/
│   │   │   │   │   ├── tenant.interceptor.ts
│   │   │   │   │   └── audit.interceptor.ts
│   │   │   │   ├── filters/
│   │   │   │   │   └── global-exception.filter.ts
│   │   │   │   └── config/
│   │   │   │       ├── configuration.ts
│   │   │   │       └── validation.ts
│   │   │   │
│   │   │   ├── auth/
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── strategies/
│   │   │   │   │   ├── jwt.strategy.ts
│   │   │   │   │   └── local.strategy.ts
│   │   │   │   └── dto/
│   │   │   │       ├── login.dto.ts
│   │   │   │       └── register.dto.ts
│   │   │   │
│   │   │   ├── companies/
│   │   │   │   ├── companies.module.ts
│   │   │   │   ├── companies.controller.ts
│   │   │   │   ├── companies.service.ts
│   │   │   │   └── dto/
│   │   │   │       ├── create-company.dto.ts
│   │   │   │       └── update-company.dto.ts
│   │   │   │
│   │   │   ├── users/
│   │   │   │   ├── users.module.ts
│   │   │   │   ├── users.controller.ts
│   │   │   │   ├── users.service.ts
│   │   │   │   └── dto/
│   │   │   │
│   │   │   ├── collaborators/
│   │   │   │   ├── collaborators.module.ts
│   │   │   │   ├── collaborators.controller.ts
│   │   │   │   ├── collaborators.service.ts
│   │   │   │   └── dto/
│   │   │   │       ├── create-collaborator.dto.ts
│   │   │   │       └── update-collaborator.dto.ts
│   │   │   │
│   │   │   ├── clients/
│   │   │   │   ├── clients.module.ts
│   │   │   │   ├── clients.controller.ts
│   │   │   │   ├── clients.service.ts
│   │   │   │   └── dto/
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── services.module.ts
│   │   │   │   ├── services.controller.ts
│   │   │   │   ├── services.service.ts
│   │   │   │   └── dto/
│   │   │   │
│   │   │   ├── schedule/
│   │   │   │   ├── schedule.module.ts
│   │   │   │   ├── schedule.controller.ts
│   │   │   │   ├── schedule.service.ts
│   │   │   │   ├── schedule-engine.service.ts
│   │   │   │   ├── schedule-rules.service.ts
│   │   │   │   └── dto/
│   │   │   │
│   │   │   ├── queue/
│   │   │   │   ├── queue.module.ts
│   │   │   │   ├── queue.controller.ts
│   │   │   │   ├── queue.service.ts
│   │   │   │   ├── queue.gateway.ts
│   │   │   │   └── dto/
│   │   │   │
│   │   │   ├── business-hours/
│   │   │   │   ├── business-hours.module.ts
│   │   │   │   ├── business-hours.controller.ts
│   │   │   │   ├── business-hours.service.ts
│   │   │   │   └── dto/
│   │   │   │
│   │   │   ├── payments/
│   │   │   │   ├── payments.module.ts
│   │   │   │   ├── payments.controller.ts
│   │   │   │   ├── payments.service.ts
│   │   │   │   ├── mercadopago.service.ts
│   │   │   │   └── dto/
│   │   │   │
│   │   │   ├── whatsapp/
│   │   │   │   ├── whatsapp.module.ts
│   │   │   │   ├── whatsapp.controller.ts
│   │   │   │   ├── whatsapp.service.ts
│   │   │   │   ├── bot/
│   │   │   │   │   ├── client-bot.service.ts
│   │   │   │   │   ├── collaborator-bot.service.ts
│   │   │   │   │   ├── conversation-state.service.ts
│   │   │   │   │   └── steps/
│   │   │   │   │       ├── base.step.ts
│   │   │   │   │       ├── greeting.step.ts
│   │   │   │   │       ├── select-service.step.ts
│   │   │   │   │       ├── select-collaborator.step.ts
│   │   │   │   │       ├── select-date.step.ts
│   │   │   │   │       ├── select-time.step.ts
│   │   │   │   │       ├── confirm-appointment.step.ts
│   │   │   │   │       ├── upload-document.step.ts
│   │   │   │   │       ├── cancel-appointment.step.ts
│   │   │   │   │       ├── reschedule.step.ts
│   │   │   │   │       ├── queue-join.step.ts
│   │   │   │   │       └── queue-position.step.ts
│   │   │   │   └── templates/
│   │   │   │       ├── client.templates.ts
│   │   │   │       └── collaborator.templates.ts
│   │   │   │
│   │   │   ├── notifications/
│   │   │   │   ├── notifications.module.ts
│   │   │   │   ├── notifications.service.ts
│   │   │   │   ├── notification-scheduler.service.ts
│   │   │   │   └── processors/
│   │   │   │       └── whatsapp-notification.processor.ts
│   │   │   │
│   │   │   ├── reports/
│   │   │   │   ├── reports.module.ts
│   │   │   │   ├── reports.controller.ts
│   │   │   │   ├── reports.service.ts
│   │   │   │   └── dto/
│   │   │   │
│   │   │   ├── settings/
│   │   │   │   ├── settings.module.ts
│   │   │   │   ├── settings.controller.ts
│   │   │   │   ├── settings.service.ts
│   │   │   │   └── dto/
│   │   │   │
│   │   │   └── audit/
│   │   │       ├── audit.module.ts
│   │   │       └── audit.service.ts
│   │   │
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   │
│   │   ├── test/
│   │   │   ├── app.e2e-spec.ts
│   │   │   └── jest-e2e.json
│   │   │
│   │   ├── .env.example
│   │   ├── .env
│   │   ├── nest-cli.json
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.build.json
│   │
│   └── web/                           # Next.js Frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/
│       │   │   │   ├── login/
│       │   │   │   │   └── page.tsx
│       │   │   │   └── layout.tsx
│       │   │   │
│       │   │   └── (dashboard)/
│       │   │       ├── layout.tsx
│       │   │       ├── page.tsx                    # KPIs
│       │   │       ├── appointments/
│       │   │       │   ├── page.tsx
│       │   │       │   ├── new/page.tsx
│       │   │       │   └── [id]/page.tsx
│       │   │       ├── queue/
│       │   │       │   └── page.tsx
│       │   │       ├── collaborators/
│       │   │       │   ├── page.tsx
│       │   │       │   └── [id]/page.tsx
│       │   │       ├── clients/
│       │   │       │   ├── page.tsx
│       │   │       │   └── [id]/page.tsx
│       │   │       ├── services/
│       │   │       │   ├── page.tsx
│       │   │       │   └── [id]/page.tsx
│       │   │       ├── schedule/
│       │   │       │   └── page.tsx
│       │   │       ├── reports/
│       │   │       │   └── page.tsx
│       │   │       └── settings/
│       │   │           ├── page.tsx
│       │   │           ├── whatsapp/page.tsx
│       │   │           ├── payments/page.tsx
│       │   │           └── rules/page.tsx
│       │   │
│       │   ├── components/
│       │   │   ├── ui/                 # Shadcn UI components (gerados)
│       │   │   ├── layout/
│       │   │   │   ├── sidebar.tsx
│       │   │   │   ├── header.tsx
│       │   │   │   └── breadcrumb.tsx
│       │   │   ├── dashboard/
│       │   │   │   ├── kpi-card.tsx
│       │   │   │   └── charts/
│       │   │   ├── appointments/
│       │   │   │   ├── appointment-table.tsx
│       │   │   │   ├── appointment-form.tsx
│       │   │   │   └── appointment-status-badge.tsx
│       │   │   ├── queue/
│       │   │   │   ├── queue-board.tsx
│       │   │   │   ├── queue-entry-card.tsx
│       │   │   │   └── queue-add-form.tsx
│       │   │   └── shared/
│       │   │       ├── data-table.tsx
│       │   │       ├── confirm-dialog.tsx
│       │   │       └── loading-spinner.tsx
│       │   │
│       │   ├── hooks/
│       │   │   ├── use-auth.ts
│       │   │   ├── use-tenant.ts
│       │   │   ├── use-queue-socket.ts
│       │   │   └── use-appointments.ts
│       │   │
│       │   ├── lib/
│       │   │   ├── api.ts              # Axios instance com interceptors
│       │   │   ├── auth.ts             # JWT helpers
│       │   │   ├── socket.ts           # Socket.io client
│       │   │   └── utils.ts
│       │   │
│       │   ├── stores/                 # Zustand stores
│       │   │   ├── auth.store.ts
│       │   │   └── queue.store.ts
│       │   │
│       │   └── types/
│       │       ├── api.types.ts
│       │       └── domain.types.ts
│       │
│       ├── public/
│       ├── .env.example
│       ├── .env.local
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── packages/                          # Código compartilhado (monorepo)
│   └── shared/
│       ├── src/
│       │   ├── types/
│       │   │   ├── appointment.types.ts
│       │   │   ├── queue.types.ts
│       │   │   └── socket-events.types.ts
│       │   └── constants/
│       │       └── app.constants.ts
│       ├── package.json
│       └── tsconfig.json
│
├── package.json                       # Root workspace (pnpm)
├── pnpm-workspace.yaml
├── turbo.json                         # Turborepo (opcional)
└── .gitignore
```

## Convenções de Nomenclatura

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Arquivo NestJS | kebab-case | `schedule-engine.service.ts` |
| Arquivo Next.js | kebab-case ou page.tsx | `appointment-table.tsx` |
| Classes | PascalCase | `ScheduleEngineService` |
| Interfaces | IPascalCase | `IAppointmentCreate` |
| DTOs | PascalCase + Dto | `CreateAppointmentDto` |
| Enums | PascalCase | `AppointmentStatus` |
| Constantes | SCREAMING_SNAKE | `MAX_QUEUE_SIZE` |
| Env vars | SCREAMING_SNAKE | `DATABASE_URL` |

## Regras de Importação

1. Core nunca importa módulos de domínio
2. Módulos de domínio importam apenas Core e tipos compartilhados
3. WhatsApp module importa Schedule, Queue, Client, Payment
4. Notifications module importa WhatsApp
5. Nenhum módulo importa de forma circular
