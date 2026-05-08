# AgendaFlow SaaS — Fluxos do Sistema
# FASE 1 | 2026-04-30

## FLUXO 1: Cliente agenda pelo WhatsApp

```
Cliente envia qualquer mensagem
      │
      ▼
Evolution API → Webhook NestJS /whatsapp/webhook
      │
      ▼
WhatsappController.handleWebhook()
      │
      ├── Identifica instanceName → busca Company
      ├── Extrai número do remetente
      ├── Verifica se número é Collaborator → redireciona para CollaboratorBotService
      └── É Cliente → ConversationStateService.getOrCreate(companyId, number)
                │
                ▼
           ClientBotService.handle(state, message)
                │
                ▼ (estado IDLE ou expirado)
           GreetingStep
           "Olá {nome}! Bem-vindo à {empresa} 👋
            O que deseja fazer?
            1️⃣ Agendar
            2️⃣ Ver meus agendamentos
            3️⃣ Cancelar agendamento
            4️⃣ Entrar na fila
            5️⃣ Minha posição na fila"
                │
                ▼ (cliente digita "1")
           SelectServiceStep
           "Escolha o serviço:
            1️⃣ Corte R$45 (45min)
            2️⃣ Barba R$30 (30min)
            3️⃣ Corte + Barba R$65 (60min)"
                │
                ▼ (cliente escolhe)
           SelectDateStep
           "Escolha a data (próximos 7 dias disponíveis):
            1️⃣ Seg 02/05
            2️⃣ Ter 03/05
            ..."
                │
                ▼ (cliente escolhe)
           SelectTimeStep
           "Horários disponíveis em 02/05:
            1️⃣ 09:00
            2️⃣ 10:00
            3️⃣ 14:30"
                │
                ▼ (cliente escolhe)
           [SE serviço exige documento]
           "Por favor, envie uma foto de {instrução}
            antes de confirmar o agendamento."
                │
                ▼ (cliente envia mídia)
           [SE pagamento antecipado exigido]
           PaymentStep → gera link MP → envia para cliente
                │
                ▼ (pagamento confirmado via webhook MP)
           ConfirmStep
           "✅ Agendamento confirmado!
            📅 Seg 02/05 às 09:00
            ✂️ Corte - João
            📍 Barbearia do Zé
            Até lá! 🤙"
                │
                ▼
           ConversationState → IDLE
           Notification.enqueue(APPOINTMENT_CONFIRMED)
           AuditLog.create()
           [SE n8n configurado] → dispara webhook n8n
```

## FLUXO 2: Colaborador opera pelo WhatsApp

```
Colaborador envia mensagem
      │
      ▼
Evolution API → Webhook NestJS
      │
      ▼
Número identificado como Collaborator
      │
      ▼
CollaboratorBotService.handle(collaborator, message)
      │
      ├── "agenda" → retorna agenda do dia formatada
      ├── "próximo" → chama próximo da fila
      │     ├── Verifica permissão canCallNextQueue
      │     ├── Pega primeiro WAITING com prioridade VIP primeiro
      │     ├── Muda status → CALLED
      │     ├── Envia WhatsApp para o cliente: "Sua vez! Venha ao atendimento"
      │     └── Socket.io emite queue:called para dashboard
      ├── "pausa {HH:MM} {HH:MM}" → cria Break
      ├── "finalizar" → finaliza IN_SERVICE atual → COMPLETED
      ├── "agendar" → inicia fluxo de criação de agendamento
      └── "ajuda" → lista comandos disponíveis

Validação de permissão antes de cada ação:
  - Se !collaborator.canCallNextQueue → "Você não tem permissão para esta ação"
```

## FLUXO 3: Fila em tempo real no Dashboard

```
Admin abre aba Fila
      │
      ▼
Next.js QueuePage conecta via Socket.io
      │
      ▼
NestJS QueueGateway
  └── handleConnection → valida JWT → entra na room company_{id}_queue
      │
Eventos recebidos pelo dashboard:
  ├── queue:state → lista completa da fila atual
  ├── queue:joined → novo cliente entrou
  ├── queue:called → colaborador chamou próximo
  ├── queue:updated → posição ou status mudou
  └── queue:left → cliente saiu

Ações do dashboard para fila:
  POST /queue/{id}/call      → chama cliente
  POST /queue/{id}/start     → inicia atendimento
  POST /queue/reorder        → reordena (drag & drop)
  POST /queue/{id}/priority  → muda para VIP
  DELETE /queue/{id}         → remove da fila
  POST /queue/add            → adiciona manualmente
```

## FLUXO 4: Motor de Slots Disponíveis

```
ScheduleEngineService.getAvailableSlots({
  companyId, collaboratorId?, serviceId, date
})

ETAPAS DE CÁLCULO:
1. Busca BusinessHour para o dia (colaborador ou empresa)
2. Verifica SpecialDay para a data (feriado? fechado? horário especial?)
3. Calcula todos os slots do dia com base na duração do serviço
4. Subtrai slots já ocupados por Appointments (status != CANCELLED)
5. Subtrai períodos de Breaks do colaborador
6. Aplica breakAfterMinutes do serviço (ex: slot 09:00 de 45min +
   15min pausa → próximo disponível: 10:00, não 09:45)
7. Remove slots que já passaram (para hoje)
8. Retorna array de { time: "HH:MM", available: boolean }
```

## FLUXO 5: Bloqueio Automático por Faltas

```
Cron: a cada hora → AutoRulesService.checkAbsences()
      │
      ▼
Para cada Company com autoBlockEnabled = true:
  1. Busca appointments com status = NO_SHOW nas últimas autoBlockWindowDays
  2. Agrupa por clientId e conta
  3. Para cada cliente com count >= autoBlockAfterAbsences:
     ├── Verifica se já está bloqueado
     ├── Se não: bloqueia (isBlocked = true, blockedReason = "AUTO:ABSENCES")
     ├── Envia WhatsApp: "Sua conta foi suspensa por {N} ausências..."
     └── AuditLog.create(CLIENT_AUTO_BLOCKED)
```

## FLUXO 6: Pagamento Antecipado (Mercado Pago)

```
Agendamento criado com serviço que exige pagamento antecipado
      │
      ▼
PaymentsService.createAdvancePayment(appointment)
      │
      ▼
MercadopagoService.createPreference({
  title: "Agendamento - {serviço}",
  price: calculado (% ou fixo),
  external_reference: appointmentId,
  notification_url: /payments/webhook/mercadopago
})
      │
      ▼
Retorna { preferenceId, initPoint (link) }
      │
      ▼
WhatsappService.send(clientNumber,
  "💳 Para confirmar seu agendamento, efetue o pagamento:
   Valor: R$ {valor}
   Link: {initPoint}
   Validade: {expiresAt}")
      │
      ▼
Cliente paga → MP envia webhook para /payments/webhook/mercadopago
      │
      ▼
PaymentsController.handleMercadopagoWebhook()
  ├── Valida assinatura (X-Signature header)
  ├── Busca Payment por mpPaymentId
  ├── Atualiza status → PAID
  ├── Atualiza Appointment.status → CONFIRMED
  └── WhatsappService.send(clientNumber, "✅ Pagamento confirmado! ...")
```

## FLUXO 7: Lembrete Automático

```
Cron: executa a cada 15 minutos
      │
      ▼
NotificationSchedulerService.processReminders()
      │
      ├── Busca appointments onde:
      │   scheduledDate+Time entre agora e agora+2h
      │   AND status = CONFIRMED
      │   AND reminder_sent = false (campo no appointment ou tabela auxiliar)
      │
      ├── Para cada um: enqueue(APPOINTMENT_REMINDER)
      │   "⏰ Lembrete: seu agendamento é em 2h!
      │    📅 {data} às {hora}
      │    ✂️ {serviço} com {colaborador}
      │    Confirme sua presença: SIM ou NÃO"
      │
      └── Busca appointments D-1 (amanhã) → enqueue(APPOINTMENT_REMINDER)
```

## FLUXO 8: Confirmação de Presença

```
Cliente recebe lembrete com opções SIM/NÃO
      │
Cliente responde "SIM"
      │
      ▼
ClientBotService detecta contexto de confirmação pendente
      │
      ▼
AppointmentService.confirm(appointmentId)
  ├── status → CONFIRMED
  ├── confirmedAt → now()
  └── WhatsappService.send("✅ Presença confirmada! Até logo!")

Cliente responde "NÃO"
      │
      ▼
BusinessRulesService.applyCancellationPolicy(appointment)
  ├── Verifica prazo de cancelamento
  ├── Se dentro do prazo → cancela sem penalidade
  ├── Se fora do prazo → aplica penalidade configurada
  └── WhatsappService.send("Agendamento cancelado. {penalidade?}")
```
