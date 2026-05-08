# AgendaFlow SaaS — Análise de Pontos de Falha
# FASE 1 | 2026-04-30

## CRÍTICO: Isolamento Multi-Tenant

### Risco: Vazamento de dados entre tenants
- **Como ocorre:** Query sem `WHERE company_id = ?`
- **Mitigação:**
  1. TenantInterceptor injeta `companyId` em todas as requests autenticadas
  2. PrismaService extendido com wrapper que valida presença do filtro
  3. Testes de integração com 2 tenants distintos verificam isolamento
  4. Code review checklist obrigatório para novos endpoints

### Risco: JWT sem company_id
- **Como ocorre:** Token gerado incorretamente na autenticação
- **Mitigação:** JwtStrategy valida presença de `companyId` no payload

---

## CRÍTICO: WhatsApp Bot — Estado de Conversa

### Risco: Usuário em dois estados simultâneos
- **Como ocorre:** Mensagem processada duas vezes em paralelo (race condition no webhook)
- **Mitigação:**
  1. Redis distributed lock por `companyId:whatsappNumber` ao processar webhook
  2. Evolution API webhook pode duplicar mensagens → idempotency key por messageId
  3. ConversationState tem campo `updatedAt` + conditional update

### Risco: Estado de conversa corrompido
- **Como ocorre:** Crash durante processamento de step
- **Mitigação:**
  1. ConversationState salvo ANTES de processar (entrada no step)
  2. Estado anterior armazenado para rollback
  3. TTL de 30min via cron limpa estados zumbis

### Risco: Bot responde para número errado
- **Como ocorre:** Bug na lógica de roteamento de instância
- **Mitigação:**
  1. instanceName validado contra `WhatsappConfig.instanceName` do tenant
  2. Nunca usar número hardcoded — sempre buscar do banco

---

## ALTO: Motor de Agendamento

### Risco: Double booking (dois clientes no mesmo slot)
- **Como ocorre:** Race condition entre duas requisições simultâneas
- **Mitigação:**
  1. Transaction de banco com SELECT FOR UPDATE no slot
  2. Constraint única no banco: `(collaboratorId, date, time)` para appointments ativos
  3. Redis lock por `companyId:collaboratorId:date:time` (10s TTL) antes de criar

### Risco: Slot calculado errado (fuso horário)
- **Como ocorre:** Servidor em UTC, empresa no horário de Brasília
- **Mitigação:**
  1. Todas as datas armazenadas em UTC no banco
  2. `timezone` da empresa armazenado e aplicado em TODA apresentação de data
  3. Motor de slots usa `date-fns-tz` com timezone do tenant
  4. Cliente recebe horário no fuso local da empresa

### Risco: Slots exibidos como disponíveis mas estão ocupados
- **Como ocorre:** Cache desatualizado de slots
- **Mitigação:**
  1. Slots calculados em tempo real (sem cache de slots)
  2. Redis cache apenas para configurações estáticas (BusinessHours)
  3. TTL curto (5min) para qualquer cache de disponibilidade

---

## ALTO: Fila de Atendimento

### Risco: Posição na fila inconsistente
- **Como ocorre:** Reordenação simultânea por admin e bot
- **Mitigação:**
  1. Posição recalculada via SQL ORDER BY `priority DESC, joinedAt ASC`
  2. Campo `position` é denormalizado — atualizado via trigger ou função
  3. Reordenação manual usa transação com lock da tabela de fila do tenant
  4. Socket.io emite estado completo após qualquer mudança (não delta)

### Risco: Cliente chamado mas já foi embora
- **Como ocorre:** Delay entre chamada e notificação WhatsApp
- **Mitigação:**
  1. Status CALLED tem timeout configurável (ex: 5min)
  2. Se não confirmar em X min → volta para WAITING ou marca como LEFT
  3. Colaborador pode marcar manualmente como "não atendido"

---

## MÉDIO: Pagamentos Mercado Pago

### Risco: Webhook do MP não chega / chega duplicado
- **Como ocorre:** Instabilidade de rede, retry do MP
- **Mitigação:**
  1. Endpoint idempotente: verifica `payment.status` antes de processar
  2. Armazena `mpPaymentId` com unique constraint
  3. Valida assinatura HMAC do webhook (header X-Signature)
  4. Log de todos os webhooks recebidos para auditoria

### Risco: Link de pagamento expira e cliente não pagou
- **Como ocorre:** Prazo de validade da preference MP
- **Mitigação:**
  1. `expiresAt` armazenado no Payment
  2. Cron verifica pagamentos PENDING expirados
  3. Cancela agendamento automaticamente ou gera novo link

---

## MÉDIO: Evolution API (WhatsApp)

### Risco: Instância WhatsApp desconectada
- **Como ocorre:** QR code expirado, ban do WhatsApp, reconexão necessária
- **Mitigação:**
  1. Healthcheck periódico via Evolution API `/instance/connectionState`
  2. Alerta no dashboard quando instância offline
  3. Fila de notificações tem retry com exponential backoff
  4. Mensagens não enviadas ficam no BullMQ para reprocessamento

### Risco: Rate limit do WhatsApp
- **Como ocorre:** Muitas mensagens em pouco tempo
- **Mitigação:**
  1. BullMQ com rate limiter: máx N msgs/segundo por instância
  2. Prioridade: operacionais (chamada na fila) > lembretes > marketing

### Risco: Número banido pelo WhatsApp
- **Como ocorre:** Conteúdo suspeito, volume alto, denúncias
- **Mitigação:**
  1. Nunca enviar mensagens sem o cliente ter interagido primeiro
  2. Templates de mensagem simples, sem spam
  3. Documentar no onboarding: usar número dedicado ao negócio

---

## BAIXO: Escalabilidade

### Risco: N+1 queries no Prisma
- **Como ocorre:** Loop com query dentro
- **Mitigação:**
  1. Usar `include` e `select` do Prisma cuidadosamente
  2. Paginação obrigatória em listagens (máx 100 itens)
  3. Índices no banco para todos os filtros frequentes

### Risco: WebSocket com muitos tenants
- **Como ocorre:** Muitas connections simultâneas
- **Mitigação:**
  1. Redis Adapter para Socket.io (suporta múltiplas instâncias do servidor)
  2. Rooms isoladas por tenant (company_{id}_queue)

---

## Checklist de Segurança Pre-Deploy

- [ ] Rate limiting em todos os endpoints públicos (especialmente /whatsapp/webhook)
- [ ] CORS configurado com whitelist de origens
- [ ] Helmet.js habilitado no NestJS
- [ ] Secrets não commitados (verificar .gitignore)
- [ ] Webhook do MP validado por assinatura HMAC
- [ ] Webhook do Evolution API validado por token fixo configurado
- [ ] Senhas hasheadas com bcrypt (custo >= 12)
- [ ] JWT com expiração curta (15min access + 7d refresh)
- [ ] SQL injection: impossível via Prisma (parameterized)
- [ ] XSS: impossível no backend, validar no frontend
- [ ] LGPD: rota para exportar/deletar dados do cliente
- [ ] Logs não contêm dados sensíveis (número WhatsApp, valor de pagamento: ok. Senha, token: NUNCA)
