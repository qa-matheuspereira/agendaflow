import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/core/database/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { ScheduleEngineService } from '@/schedule-engine/schedule-engine.service';
import { AppointmentStatus, Prisma, type WhatsappConfig } from '@prisma/client';
import Groq from 'groq-sdk';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'groq-sdk/resources/chat/completions';
import { differenceInMinutes } from 'date-fns';

interface AiContext {
  messages: ChatCompletionMessageParam[];
  clientId?: string;
  clientName?: string;
  whatsappNumber: string;
  config?: WhatsappConfig | null;
}

const MAX_HISTORY = 12;
const TOOL_LOOP_LIMIT = 6;
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

function applyPlaceholders(template: string, vars: Record<string, string>): string {
  return template.replace(/[{｛]\s*(\w+)\s*[}｛]/gi, (_, key) => vars[key.toLowerCase()] ?? `{${key}}`);
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function buildSystemPrompt(cfg: WhatsappConfig | null | undefined, clientName?: string): string {
  const personality = cfg?.aiPersonality?.trim()
    || 'Seja simpático, descontraído e use linguagem informal. Pode usar emojis com moderação. Respostas curtas, no estilo de conversa de WhatsApp.';
  const today = todayIso();
  const lines = [
    'Você é um assistente de agendamento via WhatsApp. Responda SEMPRE em português brasileiro.',
    `Data de hoje: ${today}. Use para interpretar "hoje", "amanhã", "semana que vem", etc.`,
    '',
    `ESTILO: ${personality}`,
    '',
    'REGRAS:',
    '1. Use SOMENTE as ferramentas para buscar dados — nunca invente.',
    clientName
      ? `2. O nome do cliente já é conhecido: "${clientName}". NÃO pergunte o nome novamente.`
      : '2. Se não souber o nome do cliente, pergunte UMA VEZ no início e chame register_client_name.',
    '3. Nunca invente IDs — use apenas os retornados pelas ferramentas.',
    '4. Quando book_appointment ou book_multiple_appointments retornar confirmation_message, envie EXATAMENTE esse texto.',
    '5. Quando cancel_appointment retornar cancellation_message, envie EXATAMENTE esse texto.',
    '6. Horários: lista numerada (1 - 08:00, 2 - 08:30...).',
    '7. Datas: DD/MM com dia da semana (02/06 (Seg)).',
    '8. Datas SEMPRE YYYY-MM-DD. Horários SEMPRE HH:MM.',
    '9. Máximo 4 linhas por resposta, exceto ao listar horários/datas.',
    '10. Se o cliente quiser mais de um serviço, use book_multiple_appointments passando todos os IDs.',
    cfg?.greetingMessage ? `\nSAUDAÇÃO INICIAL: ${cfg.greetingMessage}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

function extractRetryMs(errorMessage: string): number {
  const match = errorMessage.match(/try again in (\d+(?:\.\d+)?)s/i);
  return match ? Math.ceil(parseFloat(match[1]) * 1000) + 500 : 20000;
}

@Injectable()
export class WhatsappAiService {
  private readonly logger = new Logger(WhatsappAiService.name);
  private readonly groq: Groq | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly scheduleEngine: ScheduleEngineService,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('GROQ_API_KEY');
    if (apiKey) {
      this.groq = new Groq({ apiKey });
      this.logger.log('Groq AI interpreter enabled');
    }
  }

  get isEnabled(): boolean {
    return !!this.groq;
  }

  private async groqCreate(
    params: Parameters<Groq['chat']['completions']['create']>[0],
    retries = 3,
  ): Promise<Groq.Chat.ChatCompletion> {
    try {
      return await this.groq!.chat.completions.create(params) as Groq.Chat.ChatCompletion;
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      if (error?.status === 429 && retries > 0) {
        const waitMs = extractRetryMs(error?.message ?? '');
        this.logger.warn(`[AI] Rate limited — waiting ${waitMs}ms then retrying (${retries} retries left)`);
        await new Promise((r) => setTimeout(r, waitMs));
        return this.groqCreate(params, retries - 1);
      }
      throw err;
    }
  }

  async handle(
    instanceName: string,
    sendNumber: string,
    whatsappNumber: string,
    messageText: string,
    companyId: string,
    existingContext: Record<string, unknown>,
    clientId: string | null,
    clientName: string | null,
  ): Promise<Record<string, unknown>> {
    if (!this.groq) throw new Error('Groq not initialized');

    const waCfg = await this.prisma.whatsappConfig.findUnique({ where: { companyId } });

    const ctx: AiContext = {
      messages: (existingContext.messages as ChatCompletionMessageParam[] | undefined) ?? [],
      clientId: clientId ?? undefined,
      clientName: clientName ?? undefined,
      whatsappNumber,
      config: waCfg,
    };

    if (ctx.messages.length > MAX_HISTORY) ctx.messages = ctx.messages.slice(-MAX_HISTORY);

    ctx.messages.push({ role: 'user', content: messageText });

    const systemPrompt = buildSystemPrompt(waCfg, ctx.clientName);
    const tools = this.buildTools();

    let response = await this.groqCreate({
      model: GROQ_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...ctx.messages],
      tools,
      tool_choice: 'auto',
      max_tokens: 512,
      temperature: 0.3,
    });

    let loops = 0;
    while (response.choices[0].finish_reason === 'tool_calls' && loops < TOOL_LOOP_LIMIT) {
      loops++;
      const assistantMsg = response.choices[0].message;
      ctx.messages.push(assistantMsg as ChatCompletionMessageParam);

      const toolResults: ChatCompletionMessageParam[] = [];
      for (const toolCall of assistantMsg.tool_calls ?? []) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>; } catch { args = {}; }
        const result = await this.executeTool(toolCall.function.name, args, companyId, ctx);
        toolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
      }
      ctx.messages.push(...toolResults);

      response = await this.groqCreate({
        model: GROQ_MODEL,
        messages: [{ role: 'system', content: systemPrompt }, ...ctx.messages],
        tools,
        tool_choice: 'auto',
        max_tokens: 512,
        temperature: 0.3,
      });
    }

    let finalText = response.choices[0].message.content?.trim() || '';

    // Fallback: detect leaked <function=name>{...}</function> and execute
    const leakRe = /<function=(\w+)>([\s\S]*?)<\/function>/g;
    const leaked: { name: string; args: Record<string, string> }[] = [];
    let m: RegExpExecArray | null;
    while ((m = leakRe.exec(finalText)) !== null) {
      try { leaked.push({ name: m[1], args: JSON.parse(m[2]) as Record<string, string> }); } catch { /* skip */ }
    }
    if (leaked.length > 0) {
      this.logger.warn(`[AI] ${leaked.length} leaked tool call(s) — executing fallback`);
      finalText = finalText.replace(/<function=\w+>[\s\S]*?<\/function>/g, '').trim();
      const assistantPart: ChatCompletionMessageParam = {
        role: 'assistant', content: finalText || null,
        tool_calls: leaked.map((lc, i) => ({ id: `leak_${i}`, type: 'function' as const, function: { name: lc.name, arguments: JSON.stringify(lc.args) } })),
      };
      ctx.messages.push(assistantPart);
      const leakResults: ChatCompletionMessageParam[] = [];
      for (let i = 0; i < leaked.length; i++) {
        const result = await this.executeTool(leaked[i].name, leaked[i].args, companyId, ctx);
        leakResults.push({ role: 'tool', tool_call_id: `leak_${i}`, content: JSON.stringify(result) });
      }
      ctx.messages.push(...leakResults);
      const retry = await this.groqCreate({
        model: GROQ_MODEL,
        messages: [{ role: 'system', content: systemPrompt }, ...ctx.messages],
        max_tokens: 512, temperature: 0.3,
      });
      finalText = retry.choices[0].message.content?.trim() || '';
    }

    if (!finalText) finalText = 'Desculpe, não consegui processar. Pode repetir?';
    ctx.messages.push({ role: 'assistant', content: finalText });
    await this.whatsapp.sendText(instanceName, sendNumber, finalText);

    return { messages: ctx.messages.slice(-MAX_HISTORY), clientId: ctx.clientId, clientName: ctx.clientName };
  }

  private buildTools(): ChatCompletionTool[] {
    return [
      { type: 'function', function: { name: 'register_client_name', description: 'Registra o nome do cliente', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } },
      { type: 'function', function: { name: 'list_services', description: 'Lista serviços disponíveis', parameters: { type: 'object', properties: {}, required: [] } } },
      { type: 'function', function: { name: 'get_available_dates', description: 'Busca datas disponíveis nos próximos 7 dias para um serviço', parameters: { type: 'object', properties: { service_id: { type: 'string' } }, required: ['service_id'] } } },
      { type: 'function', function: { name: 'get_available_slots', description: 'Busca horários disponíveis para um serviço em uma data', parameters: { type: 'object', properties: { service_id: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['service_id', 'date'] } } },
      { type: 'function', function: { name: 'book_appointment', description: 'Cria agendamento para o cliente', parameters: { type: 'object', properties: { service_id: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' }, time: { type: 'string', description: 'HH:MM' } }, required: ['service_id', 'date', 'time'] } } },
      { type: 'function', function: { name: 'list_my_appointments', description: 'Lista próximos agendamentos do cliente', parameters: { type: 'object', properties: {}, required: [] } } },
      { type: 'function', function: { name: 'cancel_appointment', description: 'Cancela agendamento pelo ID', parameters: { type: 'object', properties: { appointment_id: { type: 'string' } }, required: ['appointment_id'] } } },
      { type: 'function', function: { name: 'get_next_appointment_info', description: 'Retorna próximo agendamento e tempo restante. Use para "falta quanto tempo?", "quando é meu horário?"', parameters: { type: 'object', properties: {}, required: [] } } },
      {
        type: 'function', function: {
          name: 'book_multiple_appointments',
          description: 'Agenda múltiplos serviços sequencialmente para o cliente. Use quando o cliente quer mais de um serviço de uma vez. Os serviços são agendados em sequência no mesmo profissional.',
          parameters: {
            type: 'object',
            properties: {
              service_ids: { type: 'array', items: { type: 'string' }, description: 'Lista de IDs dos serviços na ordem desejada' },
              date: { type: 'string', description: 'Data no formato YYYY-MM-DD' },
              start_time: { type: 'string', description: 'Horário de início do primeiro serviço no formato HH:MM' },
            },
            required: ['service_ids', 'date', 'start_time'],
          },
        },
      },
    ];
  }

  private async executeTool(toolName: string, args: Record<string, unknown>, companyId: string, ctx: AiContext): Promise<unknown> {
    this.logger.debug(`[AI] tool=${toolName} clientId=${ctx.clientId}`);
    const str = (k: string) => String(args[k] ?? '');

    switch (toolName) {
      case 'register_client_name': {
        const name = str('name').trim().slice(0, 100);
        if (name.length < 2) return { error: 'Nome muito curto.' };
        const client = await this.prisma.client.upsert({
          where: { companyId_whatsappNumber: { companyId, whatsappNumber: ctx.whatsappNumber } },
          create: { companyId, whatsappNumber: ctx.whatsappNumber, name },
          update: { name },
        });
        ctx.clientId = client.id;
        ctx.clientName = name;
        return { success: true, client_id: client.id, name };
      }

      case 'list_services': {
        const services = await this.prisma.service.findMany({
          where: { companyId, isActive: true },
          select: { id: true, name: true, durationMinutes: true, price: true, category: { select: { name: true } } },
          orderBy: [{ order: 'asc' }, { name: 'asc' }],
        });
        return services.map((s) => ({ id: s.id, name: s.name, duration_minutes: s.durationMinutes, price: `R$ ${Number(s.price).toFixed(2).replace('.', ',')}`, category: s.category?.name ?? null }));
      }

      case 'get_available_dates': {
        const svcId = str('service_id');
        if (!svcId) return { error: 'service_id obrigatório' };
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const end = new Date(now); end.setDate(end.getDate() + 6);
        try {
          const dates = await this.scheduleEngine.getAvailableDatesInRange(companyId, svcId, undefined, now, end);
          return { available_dates: dates.map((d) => { const [y, mo, da] = d.split('-'); return { date_iso: d, date_br: `${da}/${mo}/${y}` }; }) };
        } catch (e) { this.logger.error(`get_available_dates: ${e}`); return { error: 'Erro ao buscar datas.' }; }
      }

      case 'get_available_slots': {
        const svcId2 = str('service_id'); const dateArg = str('date');
        if (!svcId2 || !dateArg) return { error: 'service_id e date obrigatórios' };
        try {
          const all = await this.scheduleEngine.getAvailableSlots(companyId, { date: dateArg, serviceId: svcId2 } as Parameters<ScheduleEngineService['getAvailableSlots']>[1]);
          return { available_slots: all.filter((s) => s.available).map((s) => s.time) };
        } catch (e) { this.logger.error(`get_available_slots: ${e}`); return { error: 'Erro ao buscar horários.' }; }
      }

      case 'book_appointment': {
        if (!ctx.clientId) return { error: 'Preciso do seu nome antes de agendar. Qual é o seu nome?' };
        const svcId3 = str('service_id'); const dateArg2 = str('date'); const timeArg = str('time');
        if (!svcId3 || !dateArg2 || !timeArg) return { error: 'Informe serviço, data e horário.' };
        const collabs = await this.prisma.collaborator.findMany({
          where: { companyId, isActive: true, services: { some: { serviceId: svcId3 } } },
          select: { id: true, name: true, appointments: { where: { scheduledDate: { gte: new Date(dateArg2 + 'T00:00:00.000Z'), lte: new Date(dateArg2 + 'T23:59:59.999Z') }, status: { notIn: [AppointmentStatus.CANCELLED] } }, select: { id: true } } },
        });
        if (collabs.length === 0) return { error: 'Nenhum profissional disponível.' };
        collabs.sort((a, b) => a.appointments.length - b.appointments.length);
        const collab = collabs[0];
        const service = await this.prisma.service.findUnique({ where: { id: svcId3 }, select: { name: true, durationMinutes: true } });
        if (!service) return { error: 'Serviço não encontrado.' };
        const [h, mi] = timeArg.split(':').map(Number);
        const endM = h * 60 + mi + service.durationMinutes;
        const endTime = `${Math.floor(endM / 60).toString().padStart(2, '0')}:${(endM % 60).toString().padStart(2, '0')}`;
        try {
          await this.prisma.$transaction(async (tx) => {
            const conflict = await tx.appointment.findFirst({ where: { companyId, collaboratorId: collab.id, scheduledDate: new Date(dateArg2 + 'T00:00:00.000Z'), scheduledTime: timeArg, status: { notIn: [AppointmentStatus.CANCELLED] } } });
            if (conflict) throw new Error('SLOT_TAKEN');
            await tx.appointment.create({ data: { companyId, clientId: ctx.clientId!, collaboratorId: collab.id, serviceId: svcId3, scheduledDate: new Date(dateArg2 + 'T00:00:00.000Z'), scheduledTime: timeArg, endTime, status: AppointmentStatus.SCHEDULED, createdViaBot: true } });
          }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
          const [y, mo, da] = dateArg2.split('-');
          const dateF = `${da}/${mo}/${y}`;
          const customMsg = ctx.config?.scheduleConfirmMsg?.trim();
          const confirmation_message = customMsg
            ? applyPlaceholders(customMsg, { nome: ctx.clientName ?? 'Cliente', servico: service.name, horario: timeArg, profissional: collab.name, data: dateF })
            : `*Agendamento confirmado!* ✅\n\nData: ${dateF}\nHorário: ${timeArg}\nServiço: ${service.name}\nProfissional: ${collab.name}`;
          return { success: true, confirmation_message };
        } catch { return { error: 'Horário indisponível. Tente outro.' }; }
      }

      case 'list_my_appointments': {
        if (!ctx.clientId) return { appointments: [] };
        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        const appts = await this.prisma.appointment.findMany({
          where: { companyId, clientId: ctx.clientId, scheduledDate: { gte: today }, status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED] } },
          include: { service: { select: { name: true } }, collaborator: { select: { name: true } } },
          orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }], take: 5,
        });
        return { appointments: appts.map((a) => ({ id: a.id, date: a.scheduledDate.toISOString().slice(0, 10).split('-').reverse().join('/'), time: a.scheduledTime, service: a.service.name, collaborator: a.collaborator.name, status: a.status })) };
      }

      case 'cancel_appointment': {
        if (!ctx.clientId) return { error: 'Cliente não identificado.' };
        const apptId = str('appointment_id');
        if (!apptId) return { error: 'appointment_id obrigatório.' };
        const appt = await this.prisma.appointment.findFirst({ where: { id: apptId, companyId, clientId: ctx.clientId }, include: { service: { select: { name: true } }, collaborator: { select: { name: true } } } });
        if (!appt) return { error: 'Agendamento não encontrado.' };
        if (!['SCHEDULED', 'CONFIRMED'].includes(appt.status)) return { error: `Não é possível cancelar: status ${appt.status}.` };
        await this.prisma.appointment.update({ where: { id: apptId }, data: { status: AppointmentStatus.CANCELLED, cancelledAt: new Date(), cancelReason: 'Cancelado pelo cliente via WhatsApp' } });
        const dateF = appt.scheduledDate.toISOString().slice(0, 10).split('-').reverse().join('/');
        const customMsg = ctx.config?.cancellationMessage?.trim();
        const cancellation_message = customMsg
          ? applyPlaceholders(customMsg, { nome: ctx.clientName ?? 'Cliente', servico: appt.service.name, horario: appt.scheduledTime, profissional: appt.collaborator.name, data: dateF })
          : `*Agendamento cancelado!*\n\n${dateF} às ${appt.scheduledTime}\n${appt.service.name} com ${appt.collaborator.name}`;
        return { success: true, cancellation_message };
      }

      case 'get_next_appointment_info': {
        if (!ctx.clientId) return { error: 'Cliente não identificado.' };
        const now = new Date();
        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        const appt = await this.prisma.appointment.findFirst({
          where: { companyId, clientId: ctx.clientId, scheduledDate: { gte: today }, status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] } },
          include: { service: { select: { name: true } }, collaborator: { select: { name: true } } },
          orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
        });
        if (!appt) return { found: false, message: 'Nenhum agendamento futuro.' };
        const dateStr = appt.scheduledDate.toISOString().slice(0, 10);
        const apptDt = new Date(`${dateStr}T${appt.scheduledTime}:00`);
        const minUntil = differenceInMinutes(apptDt, now);
        const h = Math.floor(minUntil / 60); const m = minUntil % 60;
        const timeLabel = minUntil < 0 ? 'já passou' : minUntil < 60 ? `${minUntil} minutos` : `${h}h${m > 0 ? ` e ${m}min` : ''}`;
        return { found: true, date: dateStr.split('-').reverse().join('/'), time: appt.scheduledTime, service: appt.service.name, collaborator: appt.collaborator.name, time_until: timeLabel, reminder_info: ctx.config?.reminderHoursBefore ? `Lembrete ${ctx.config.reminderHoursBefore}h antes.` : null };
      }

      case 'book_multiple_appointments': {
        if (!ctx.clientId) return { error: 'Preciso do seu nome antes de agendar. Qual é o seu nome?' };
        const serviceIds = (args.service_ids as string[] | undefined) ?? [];
        const date = args.date as string;
        const startTime = args.start_time as string;
        if (serviceIds.length === 0 || !date || !startTime) return { error: 'Informe os serviços, data e horário.' };

        // Load all services
        const services = await this.prisma.service.findMany({
          where: { id: { in: serviceIds }, companyId },
          select: { id: true, name: true, durationMinutes: true, breakAfterMinutes: true },
        });
        if (services.length === 0) return { error: 'Serviços não encontrados.' };

        // Sort by requested order
        const ordered = serviceIds.map((id) => services.find((s) => s.id === id)).filter(Boolean) as typeof services;

        // Find least loaded collaborator for first service
        const [h0, m0] = startTime.split(':').map(Number);
        const collabs = await this.prisma.collaborator.findMany({
          where: { companyId, isActive: true, services: { some: { serviceId: ordered[0].id } } },
          select: {
            id: true, name: true,
            appointments: {
              where: { scheduledDate: { gte: new Date(date + 'T00:00:00.000Z'), lte: new Date(date + 'T23:59:59.999Z') }, status: { notIn: [AppointmentStatus.CANCELLED] } },
              select: { id: true },
            },
          },
        });
        if (collabs.length === 0) return { error: 'Nenhum profissional disponível.' };
        collabs.sort((a, b) => a.appointments.length - b.appointments.length);
        const collab = collabs[0];

        // Build sequential slots
        type ApptSlot = { serviceId: string; serviceName: string; startMin: number; endMin: number; startTime: string; endTime: string };
        const slots: ApptSlot[] = [];
        let cursor = h0 * 60 + m0;
        for (const svc of ordered) {
          const startT = `${Math.floor(cursor / 60).toString().padStart(2, '0')}:${(cursor % 60).toString().padStart(2, '0')}`;
          const endMin = cursor + svc.durationMinutes;
          const endT = `${Math.floor(endMin / 60).toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`;
          slots.push({ serviceId: svc.id, serviceName: svc.name, startMin: cursor, endMin, startTime: startT, endTime: endT });
          cursor = endMin + svc.breakAfterMinutes;
        }

        // Create all appointments in a transaction
        try {
          await this.prisma.$transaction(async (tx) => {
            for (const slot of slots) {
              const conflict = await tx.appointment.findFirst({
                where: { companyId, collaboratorId: collab.id, scheduledDate: new Date(date + 'T00:00:00.000Z'), scheduledTime: slot.startTime, status: { notIn: [AppointmentStatus.CANCELLED] } },
              });
              if (conflict) throw new Error('SLOT_TAKEN');
              await tx.appointment.create({
                data: { companyId, clientId: ctx.clientId!, collaboratorId: collab.id, serviceId: slot.serviceId, scheduledDate: new Date(date + 'T00:00:00.000Z'), scheduledTime: slot.startTime, endTime: slot.endTime, status: AppointmentStatus.SCHEDULED, createdViaBot: true },
              });
            }
          }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

          const [y, mo, da] = date.split('-');
          const dateF = `${da}/${mo}/${y}`;
          const totalMin = slots[slots.length - 1].endMin - (h0 * 60 + m0);
          const serviceNames = ordered.map((s) => s.name).join(' + ');
          const confirmation_message = `*Agendamentos confirmados!* ✅\n\n📅 ${dateF} às ${startTime}\n✂️ ${serviceNames}\n👤 ${collab.name}\n⏱ Duração total: ${totalMin} min`;
          return { success: true, confirmation_message, total_minutes: totalMin, services: slots.map((s) => ({ name: s.serviceName, time: s.startTime })) };
        } catch {
          return { error: 'Horário indisponível para um dos serviços. Tente outro horário.' };
        }
      }

      default: return { error: `Ferramenta desconhecida: ${toolName}` };
    }
  }
}
