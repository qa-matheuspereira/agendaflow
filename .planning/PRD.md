# AgendaFlow SaaS — Product Requirements Document (PRD)
# FASE 1 — Versão 1.0 | 2026-04-30

## Visão do Produto
SaaS B2B multitenant de agendamento e fila inteligente.
Admin gerencia pelo painel web. Cliente e Colaborador operam 100% pelo WhatsApp.

## Personas
- SUPER_ADMIN: Gestor da plataforma (cross-tenant)
- ADMIN: Dono da empresa tenant
- MANAGER: Gerente com acesso parcial ao painel
- RECEPTIONIST: Acesso limitado ao painel (agendamentos + fila)
- COLLABORATOR: Opera exclusivamente pelo WhatsApp
- CLIENT: Opera exclusivamente pelo WhatsApp

## Modos de Agendamento (configurável por empresa)
- SCHEDULE_ONLY: Somente horários fixos
- QUEUE_ONLY: Somente fila
- HYBRID: Horário + fila de espera

## Status de Agendamento
SCHEDULED → CONFIRMED → IN_PROGRESS → COMPLETED
SCHEDULED → CANCELLED
CONFIRMED → NO_SHOW

## Status de Fila
WAITING → CALLED → IN_SERVICE → DONE
WAITING → LEFT

## Roles e Permissões WhatsApp Colaborador (granular por empresa)
- can_view_schedule
- can_create_schedule
- can_edit_schedule
- can_delete_schedule
- can_create_break
- can_call_next_queue
- can_finish_service
