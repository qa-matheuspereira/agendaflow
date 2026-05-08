# PROJECT SNAPSHOT — AgendaFlow SaaS
> Generated: 2026-04-30 | Status: FASE 3.5 complete, typecheck + build clean

---

## 1. IMPLEMENTED MODULES

### Backend (apps/api/src/)

| Module | Controller | Service | Gateway | Status |
|---|---|---|---|---|
| auth | ✓ | ✓ | — | Complete |
| appointments | ✓ | ✓ | — | Complete |
| clients | ✓ | ✓ | — | Complete |
| collaborators | ✓ | ✓ | — | Complete |
| companies | ✓ | ✓ | — | Complete |
| services | ✓ | ✓ | — | Complete |
| business-hours | ✓ | ✓ | — | Complete |
| schedule-engine | — | ✓ | — | Complete |
| queue | ✓ | ✓ | ✓ (WebSocket) | Complete |
| payments | ✓ | ✓ | — | Partial — HMAC validation done, SDK stubs only |
| reports | ✓ | ✓ | — | Complete |
| settings | ✓ | ✓ | — | Complete |
| audit | ✓ | ✓ | — | Complete |
| whatsapp | ✓ | ✓ | — | Partial — webhook receiver done, chatbot logic stub |
| notifications | — | ✓ + processor | — | Partial — Bull queue wired, Evolution API call stub |

### Core Infrastructure

| Component | Status |
|---|---|
| PrismaService (@Global) | Complete |
| RedisService (@Global) | Complete |
| AuditService (@Global) | Complete |
| JWT strategy (access + refresh) | Complete |
| Local strategy (passport) | Complete |
| JwtAuthGuard | Complete |
| RolesGuard | Complete |
| TenantGuard (companyId extraction) | Complete |
| GlobalExceptionFilter | Complete |
| PaginationDto + paginate() | Complete |
| ConfigService (env validation) | Complete |
| Winston logger | Complete |
| Bull queue (whatsapp notifications) | Wired, Evolution API call stub |

---

## 2. FRONTEND ROUTES

| Route | File | Status |
|---|---|---|
| /login | (auth)/login/page.tsx | Complete |
| / | (dashboard)/page.tsx | Complete — KPIs dashboard |
| /appointments | (dashboard)/appointments/page.tsx | Complete |
| /clients | (dashboard)/clients/page.tsx | Complete |
| /collaborators | (dashboard)/collaborators/page.tsx | Complete |
| /services | (dashboard)/services/page.tsx | Complete — incl. advance payment, document fields |
| /schedule | (dashboard)/schedule/page.tsx | Complete — business hours + breaks + special days |
| /queue | (dashboard)/queue/page.tsx | Complete — real-time via Socket.io |
| /reports | (dashboard)/reports/page.tsx | Complete |
| /audit-logs | (dashboard)/audit-logs/page.tsx | Complete |
| /settings | (dashboard)/settings/page.tsx | Complete — business rules + WhatsApp config |

Middleware: `apps/web/src/middleware.ts` — protects all dashboard routes, redirects unauthenticated to /login.

---

## 3. BACKEND ENDPOINTS

### Auth — `/api/v1/auth`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /auth/login | Public | Email + password login |
| POST | /auth/refresh | Public | Refresh access token |
| POST | /auth/logout | JWT | Invalidates refresh token |
| GET | /auth/me | JWT | Authenticated user data |

### Appointments — `/api/v1/appointments`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /appointments/slots | JWT | Available time slots |
| POST | /appointments | JWT | Create appointment |
| GET | /appointments | JWT | List (paginated, filterable) |
| GET | /appointments/:id | JWT | Single appointment |
| PUT | /appointments/:id | JWT | Update date/time/notes |
| PATCH | /appointments/:id/confirm | JWT | SCHEDULED → CONFIRMED |
| PATCH | /appointments/:id/start | JWT | → IN_PROGRESS |
| PATCH | /appointments/:id/complete | JWT | → COMPLETED |
| PATCH | /appointments/:id/cancel | JWT | → CANCELLED (with business rules check) |
| PATCH | /appointments/:id/no-show | JWT | → NO_SHOW |

### Clients — `/api/v1/clients`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /clients | JWT | Create client |
| GET | /clients | JWT | List (paginated, search) |
| GET | /clients/:id | JWT | Single client |
| PUT | /clients/:id | JWT | Update client |
| PUT | /clients/:id/block | JWT | Block client |
| PUT | /clients/:id/unblock | JWT | Unblock client |

### Collaborators — `/api/v1/collaborators`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /collaborators | JWT | Create collaborator |
| GET | /collaborators | JWT | List (search, isActive filter) |
| GET | /collaborators/:id | JWT | Single collaborator |
| PUT | /collaborators/:id | JWT | Update collaborator |
| DELETE | /collaborators/:id | JWT | Deactivate collaborator |
| PUT | /collaborators/:id/activate | JWT | Reactivate collaborator |

### Companies — `/api/v1/companies`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /companies | JWT (SUPER_ADMIN) | Create company |
| GET | /companies | JWT (SUPER_ADMIN) | List all companies |
| GET | /companies/me | JWT | Current tenant info |
| GET | /companies/me/stats | JWT | Tenant stats |
| PUT | /companies/me | JWT | Update tenant |

### Services — `/api/v1/services`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /services/categories | JWT | Create category |
| GET | /services/categories | JWT | List categories |
| DELETE | /services/categories/:id | JWT | Delete category |
| POST | /services | JWT | Create service |
| GET | /services | JWT | List (onlyActive, search) |
| GET | /services/:id | JWT | Single service |
| PUT | /services/:id | JWT | Update service |
| DELETE | /services/:id | JWT | Deactivate service |
| PUT | /services/:id/activate | JWT | Reactivate service |

### Business Hours — `/api/v1/business-hours`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /business-hours/hours | JWT | Create business hour rule |
| GET | /business-hours/hours | JWT | List business hours |
| POST | /business-hours/special-days | JWT | Create special day / holiday |
| GET | /business-hours/special-days | JWT | List special days |
| DELETE | /business-hours/special-days/:id | JWT | Delete special day |
| POST | /business-hours/breaks | JWT | Create collaborator break |
| GET | /business-hours/breaks | JWT | List breaks |
| DELETE | /business-hours/breaks/:id | JWT | Delete break |

### Queue — `/api/v1/queue`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /queue/state | JWT | Full queue state |
| POST | /queue/join | JWT | Add client to queue |
| POST | /queue/next | JWT | Call next client |
| PUT | /queue/reorder | JWT | Reorder queue |
| PATCH | /queue/:id/start | JWT | Start service |
| PATCH | /queue/:id/finish | JWT | Finish service |
| DELETE | /queue/:id | JWT | Remove from queue |

### Payments — `/api/v1/payments`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /payments | JWT | List tenant payments |
| POST | /payments/webhook/mercadopago | Public | MP webhook (HMAC-SHA256 validated) |

### Reports — `/api/v1/reports`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /reports/kpis | JWT | KPI summary (date range) |
| GET | /reports/by-service | JWT | Revenue/volume by service |
| GET | /reports/by-collaborator | JWT | Revenue/volume by collaborator |
| GET | /reports/queue | JWT | Queue analytics |

### Settings — `/api/v1/settings`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /settings/business-rules | JWT | Get cancellation/block rules |
| PATCH | /settings/business-rules | JWT | Update rules |
| GET | /settings/whatsapp | JWT | Get WhatsApp config |
| PATCH | /settings/whatsapp | JWT | Update WhatsApp config |

### Audit — `/api/v1/audit-logs`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /audit-logs | JWT (ADMIN) | List audit logs (filterable) |

### WhatsApp — `/api/v1/whatsapp`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /whatsapp/webhook | Public | Evolution API inbound webhook |
| POST | /whatsapp/webhook/status | Public | Evolution API status webhook |

### WebSocket Namespace: `/queue`
| Event (server→client) | Description |
|---|---|
| queue:state | Full queue state update |
| queue:joined | New entry joined |
| queue:called | Entry called |
| queue:updated | Entry status changed |
| queue:left | Entry left queue |

---

## 4. FRONTEND HOOKS & STORES

### API Hooks (apps/web/src/hooks/api/)
| File | Covers |
|---|---|
| use-appointments.ts | CRUD + status mutations + slots |
| use-audit-logs.ts | GET /audit-logs with filters |
| use-business-hours.ts | Hours, special days, breaks |
| use-clients.ts | CRUD + block/unblock |
| use-collaborators.ts | CRUD + activate/deactivate |
| use-queue.ts | Queue state + join/call/finish mutations |
| use-reports.ts | KPIs + service/collaborator/queue reports |
| use-services.ts | CRUD + categories + activate/deactivate |
| use-settings.ts | Business rules + WhatsApp config |

### Realtime Hooks
| File | Covers |
|---|---|
| use-queue-socket.ts | Socket.io connection + queue:* event listeners |

### Stores (Zustand)
| File | State |
|---|---|
| auth.store.ts | user, accessToken, refreshToken, isLoading — initializeAuth, setAuth, clearAuth |
| queue.store.ts | queue state cache for optimistic updates |

---

## 5. ENVIRONMENT VARIABLES

### Backend (apps/api/.env)
```
# App
NODE_ENV=
PORT=3001

# Database
DATABASE_URL=                        # PostgreSQL connection string

# Redis
REDIS_HOST=
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_SECRET=
JWT_REFRESH_EXPIRY=7d

# WhatsApp / Evolution API
EVOLUTION_API_URL=                   # e.g. https://your-evolution.domain
EVOLUTION_API_GLOBAL_KEY=
EVOLUTION_WEBHOOK_VERIFY_TOKEN=

# Mercado Pago
MP_PLATFORM_ACCESS_TOKEN=           # Platform credentials (marketplace)
MERCADO_PAGO_WEBHOOK_SECRET=        # Webhook HMAC secret

# Frontend
FRONTEND_URL=http://localhost:3000

# Super Admin (seed only)
SUPER_ADMIN_EMAIL=
SUPER_ADMIN_PASSWORD=
```

### Frontend (apps/web/.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

---

## 6. THIRD-PARTY INTEGRATIONS

| Integration | Package | Status |
|---|---|---|
| **Mercado Pago** | mercadopago ^2.4.0 | Webhook validation done (HMAC-SHA256 + replay protection). `createPreference()` + `getPaymentStatus()` are stubs. Full flow in FASE 6. |
| **Evolution API (WhatsApp)** | axios calls | Webhook receiver done. Outbound messages wired in NotificationsService via Bull queue. Evolution API HTTP call is a stub (`TODO: call Evolution API`). Chatbot conversation flow (ConversationState) is a stub. |
| **Redis** | ioredis ^5.4.2 | Fully wired — booking locks, Socket.io adapter, Bull queue backend. |
| **Bull (job queues)** | bull ^4.16.5 | WhatsApp notification queue wired. Processor registered. |
| **Socket.io** | socket.io ^4.8.1 | Fully wired — queue namespace, Redis adapter, JWT auth on handshake. |
| **Prisma** | @prisma/client | 21 models, all queries implemented. |
| **Recharts** | recharts ^2.15.0 | Wired in reports page (KPI charts). |
| **@tanstack/react-query** | ^5.67.3 | All frontend data fetching uses query/mutation hooks. |

---

## 7. REMAINING PHASES

### FASE 4 — WhatsApp Integration (Evolution API)
**Not done:**
- `NotificationsService.sendWhatsappMessage()` — actual HTTP call to Evolution API (currently stub)
- Chatbot conversation flow — `ConversationState` model exists but handler logic is stub
- Inbound message routing (client self-service: check position, cancel appointment via WhatsApp)
- Reminder scheduler — `NotificationSchedulerService` exists but cron logic stub
- Auto-confirm appointments cron (based on `autoConfirmHours` setting)
- Auto-return message cron (based on `autoReturnAfterDays` setting)

**Already done:**
- Bull queue wired for outbound notifications
- `enqueueWhatsapp()` called from appointments + queue on all relevant state changes
- WhatsApp config model + settings endpoint

### FASE 5 — Mercado Pago Full Integration
**Not done:**
- `createPreference()` — actual SDK call to create checkout preference
- `getPaymentStatus()` — actual SDK call to query payment
- Webhook processor — parse `payment.updated` / `payment.created` events, update `Payment` model
- Advance payment flow — create payment link on appointment booking when service `requiresAdvancePayment = true`
- Refund flow on cancellation
- Per-tenant credentials (`MercadopagoConfig` model exists, `getCredentials()` done)

**Already done:**
- HMAC-SHA256 webhook signature validation with replay protection
- `Payment` model in Prisma
- `MercadopagoConfig` model + per-tenant credential storage
- Payments controller + `GET /payments` endpoint

### FASE 6 — SaaS Polish & Multi-Tenant Operations
**Not done:**
- Subscription/plan enforcement — `CompanyStatus`, `PlanType` enums exist but no middleware enforces plan limits
- Billing integration — no Stripe/payment for SaaS subscriptions (separate from per-appointment MP payments)
- SUPER_ADMIN panel — company management UI (backend endpoints exist)
- httpOnly cookie migration for tokens (currently localStorage via Zustand)
- Rate limiting per tenant (Throttle module installed, not scoped per company)
- Public booking page (unauthenticated self-scheduling for clients)
- Email notifications (no email provider integrated)
- Onboarding wizard (new company setup flow)
- Audit log UI — page exists, filtering works; export to CSV not implemented

### FASE 7 — Production Hardening
**Not done:**
- Database connection pooling config (PgBouncer / Prisma accelerate)
- Graceful shutdown handling
- Health check endpoint (`/health`)
- Docker / docker-compose for full stack
- CI/CD pipeline
- Sentry or equivalent error tracking
- Prisma migration strategy for production

---

## BUILD STATUS

| Target | Status |
|---|---|
| API typecheck | ✓ Clean (0 errors) |
| Web typecheck | ✓ Clean (0 errors) |
| API build (nest build) | ✓ Success |
| Web build (next build) | ✓ Success — 14 static routes |
