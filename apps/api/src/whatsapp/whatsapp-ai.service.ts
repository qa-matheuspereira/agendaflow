import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/core/database/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { ScheduleEngineService } from '@/schedule-engine/schedule-engine.service';
import { AppointmentStatus, Prisma, type WhatsappConfig } from '@prisma/client';
import { GoogleGenerativeAI, type Content, SchemaType } from '@google/generative-ai';
import { differenceInMinutes } from 'date-fns';

interface AiContext {
  history: Content[];
  clientId?: string;
  clientName?: string;
  whatsappNumber: string;
  config?: WhatsappConfig | null;
}

const MAX_HISTORY = 20;
const TOOL_LOOP_LIMIT = 6;

function applyPlaceholders(template: string, vars: Record<string, string>): string {
  return template.replace(/[{｛]\s*(\w+)\s*[}｝]/gi, (_, key) => vars[key.toLowerCase()] ?? `{${key}}`);
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function buildSystemPrompt(cfg: WhatsappConfig | null | undefined): string {
  const personality = cfg?.aiPersonality?.trim()
    || 'Seja simpático, descontraído e use linguagem informal. Pode usar emojis com moderação. Respostas curtas, no estilo de conversa de WhatsApp.';

  const today = todayIso();
  const lines = [
    'Você é um assistente de agendamento via WhatsApp. Responda SEMPRE em português brasileiro.',
    `Data de hoje: ${today}. Use essa data para interpretar "hoje", "amanhã", "semana que vem", etc.`,
    '',
    `ESTILO DE COMUNICAÇÃO: ${personality}`,
    '',
    'CAPACIDADES:',
    '- Listar serviços disponíveis',
    '- Buscar datas e horários disponíveis',
    '- Fazer agendamentos',
    '- Listar agendamentos do cliente',
    '- Cancelar agendamentos',
    '- Responder perguntas sobre agendamentos (ex: "falta quanto tempo?")',
    '',
    'REGRAS:',
    '1. Use SOMENTE as ferramentas para buscar dados — nunca invente informações.',
    '2. Se não souber o nome do cliente, pergunte e chame register_client_name.',
    '3. Nunca invente IDs — use apenas os retornados pelas ferramentas.',
    '4. Quando book_appointment retornar confirmation_message, envie EXATAMENTE esse texto.',
    '5. Quando cancel_appointment retornar cancellation_message, envie EXATAMENTE esse texto.',
    '6. Ao listar horários, use lista numerada: 1 - 08:00, 2 - 08:30, etc.',
    '7. Ao listar datas, mostre DD/MM com dia da semana: ex "02/06 (Seg)".',
    '8. Datas para book_appointment SEMPRE em YYYY-MM-DD. Horários SEMPRE em HH:MM.',
    '9. Máximo 4 linhas por resposta, exceto ao listar horários/datas.',
  ];

  if (cfg?.greetingMessage) {
    lines.push('', `SAUDAÇÃO (use ao cumprimentar pela primeira vez): ${cfg.greetingMessage}`);
  }

  return lines.join('\n');
}

@Injectable()
export class WhatsappAiService {
  private readonly logger = new Logger(WhatsappAiService.name);
  private readonly genAI: GoogleGenerativeAI | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly scheduleEngine: ScheduleEngineService,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('GOOGLE_AI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.logger.log('Google Gemini AI interpreter enabled');
    } else {
      const groqKey = this.config.get<string>('GROQ_API_KEY');
      if (groqKey) this.logger.warn('GROQ_API_KEY set but Gemini preferred — set GOOGLE_AI_API_KEY');
    }
  }

  get isEnabled(): boolean {
    return !!this.genAI;
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
    if (!this.genAI) throw new Error('Gemini not initialized');

    const waCfg = await this.prisma.whatsappConfig.findUnique({ where: { companyId } });

    const ctx: AiContext = {
      history: (existingContext.history as Content[] | undefined) ?? [],
      clientId: clientId ?? undefined,
      clientName: clientName ?? undefined,
      whatsappNumber,
      config: waCfg,
    };

    if (ctx.history.length > MAX_HISTORY) {
      ctx.history = ctx.history.slice(-MAX_HISTORY);
    }

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: buildSystemPrompt(waCfg),
      tools: [{ functionDeclarations: this.buildFunctionDeclarations() }],
    });

    const chat = model.startChat({ history: ctx.history });

    let result = await chat.sendMessage(messageText);
    ctx.history.push({ role: 'user', parts: [{ text: messageText }] });

    let loops = 0;
    while (loops < TOOL_LOOP_LIMIT) {
      const calls = result.response.functionCalls();
      if (!calls || calls.length === 0) break;
      loops++;

      this.logger.debug(`[AI] ${calls.length} tool call(s): ${calls.map((c) => c.name).join(', ')}`);

      const modelParts = result.response.candidates?.[0]?.content?.parts ?? [];
      ctx.history.push({ role: 'model', parts: modelParts });

      const toolResponseParts: Content['parts'] = [];
      for (const call of calls) {
        const toolResult = await this.executeTool(call.name, call.args as Record<string, string>, companyId, ctx);
        toolResponseParts.push({
          functionResponse: { name: call.name, response: toolResult as Record<string, unknown> },
        });
      }

      ctx.history.push({ role: 'user', parts: toolResponseParts });
      result = await chat.sendMessage(toolResponseParts);
    }

    const finalText = result.response.text()?.trim() || 'Desculpe, não consegui processar. Pode repetir?';
    ctx.history.push({ role: 'model', parts: [{ text: finalText }] });

    await this.whatsapp.sendText(instanceName, sendNumber, finalText);

    return {
      history: ctx.history.slice(-MAX_HISTORY),
      clientId: ctx.clientId,
      clientName: ctx.clientName,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildFunctionDeclarations(): any[] {
    return [
      {
        name: 'register_client_name',
        description: 'Registra o nome do cliente quando ele informa o nome pela primeira vez',
        parameters: {
          type: SchemaType.OBJECT,
          properties: { name: { type: SchemaType.STRING, description: 'Nome completo do cliente' } },
          required: ['name'],
        },
      },
      {
        name: 'list_services',
        description: 'Lista todos os serviços disponíveis para agendamento',
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },
      {
        name: 'get_available_dates',
        description: 'Busca datas disponíveis nos próximos 7 dias para um serviço',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            service_id: { type: SchemaType.STRING, description: 'ID do serviço retornado por list_services' },
          },
          required: ['service_id'],
        },
      },
      {
        name: 'get_available_slots',
        description: 'Busca horários disponíveis para um serviço em uma data',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            service_id: { type: SchemaType.STRING, description: 'ID do serviço' },
            date: { type: SchemaType.STRING, description: 'Data no formato YYYY-MM-DD' },
          },
          required: ['service_id', 'date'],
        },
      },
      {
        name: 'book_appointment',
        description: 'Cria um agendamento confirmado para o cliente',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            service_id: { type: SchemaType.STRING, description: 'ID do serviço' },
            date: { type: SchemaType.STRING, description: 'Data no formato YYYY-MM-DD' },
            time: { type: SchemaType.STRING, description: 'Horário no formato HH:MM' },
          },
          required: ['service_id', 'date', 'time'],
        },
      },
      {
        name: 'list_my_appointments',
        description: 'Lista os próximos agendamentos do cliente',
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },
      {
        name: 'cancel_appointment',
        description: 'Cancela um agendamento do cliente pelo ID',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            appointment_id: { type: SchemaType.STRING, description: 'ID do agendamento retornado por list_my_appointments' },
          },
          required: ['appointment_id'],
        },
      },
      {
        name: 'get_next_appointment_info',
        description: 'Retorna o próximo agendamento do cliente e tempo restante. Use para "falta quanto tempo?", "quando é meu horário?" etc.',
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },
    ];
  }

  private async executeTool(
    toolName: string,
    args: Record<string, string>,
    companyId: string,
    ctx: AiContext,
  ): Promise<unknown> {
    this.logger.debug(`[AI] tool=${toolName} clientId=${ctx.clientId}`);

    switch (toolName) {
      case 'register_client_name': {
        const name = (args.name ?? '').trim().slice(0, 100);
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
        return services.map((s) => ({
          id: s.id, name: s.name,
          duration_minutes: s.durationMinutes,
          price: `R$ ${Number(s.price).toFixed(2).replace('.', ',')}`,
          category: s.category?.name ?? null,
        }));
      }

      case 'get_available_dates': {
        if (!args.service_id) return { error: 'service_id obrigatório' };
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const end = new Date(now); end.setDate(end.getDate() + 6);
        try {
          const dates = await this.scheduleEngine.getAvailableDatesInRange(companyId, args.service_id, undefined, now, end);
          return { available_dates: dates.map((d) => { const [y, m, day] = d.split('-'); return { date_iso: d, date_br: `${day}/${m}/${y}` }; }) };
        } catch (e) {
          this.logger.error(`get_available_dates: ${e}`);
          return { error: 'Erro ao buscar datas.' };
        }
      }

      case 'get_available_slots': {
        if (!args.service_id || !args.date) return { error: 'service_id e date obrigatórios' };
        try {
          const all = await this.scheduleEngine.getAvailableSlots(companyId, {
            date: args.date, serviceId: args.service_id,
          } as Parameters<ScheduleEngineService['getAvailableSlots']>[1]);
          return { available_slots: all.filter((s) => s.available).map((s) => s.time) };
        } catch (e) {
          this.logger.error(`get_available_slots: ${e}`);
          return { error: 'Erro ao buscar horários.' };
        }
      }

      case 'book_appointment': {
        if (!ctx.clientId) return { error: 'Preciso do seu nome antes de agendar. Qual é o seu nome?' };
        if (!args.service_id || !args.date || !args.time) return { error: 'Informe serviço, data e horário.' };

        const dateStart = new Date(args.date + 'T00:00:00.000Z');
        const dateEnd = new Date(args.date + 'T23:59:59.999Z');

        const collabs = await this.prisma.collaborator.findMany({
          where: { companyId, isActive: true, services: { some: { serviceId: args.service_id } } },
          select: {
            id: true, name: true,
            appointments: {
              where: { scheduledDate: { gte: dateStart, lte: dateEnd }, status: { notIn: [AppointmentStatus.CANCELLED] } },
              select: { id: true },
            },
          },
        });
        if (collabs.length === 0) return { error: 'Nenhum profissional disponível para este serviço.' };
        collabs.sort((a, b) => a.appointments.length - b.appointments.length);
        const collab = collabs[0];

        const service = await this.prisma.service.findUnique({
          where: { id: args.service_id }, select: { name: true, durationMinutes: true },
        });
        if (!service) return { error: 'Serviço não encontrado.' };

        const [startH, startM] = args.time.split(':').map(Number);
        const endMinutes = startH * 60 + startM + service.durationMinutes;
        const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

        try {
          await this.prisma.$transaction(async (tx) => {
            const conflict = await tx.appointment.findFirst({
              where: { companyId, collaboratorId: collab.id, scheduledDate: new Date(args.date + 'T00:00:00.000Z'), scheduledTime: args.time, status: { notIn: [AppointmentStatus.CANCELLED] } },
            });
            if (conflict) throw new Error('SLOT_TAKEN');
            await tx.appointment.create({
              data: { companyId, clientId: ctx.clientId!, collaboratorId: collab.id, serviceId: args.service_id, scheduledDate: new Date(args.date + 'T00:00:00.000Z'), scheduledTime: args.time, endTime, status: AppointmentStatus.SCHEDULED, createdViaBot: true },
            });
          }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

          const [y, m, d] = args.date.split('-');
          const dateFormatted = `${d}/${m}/${y}`;
          const clientName = ctx.clientName ?? 'Cliente';
          const customMsg = ctx.config?.scheduleConfirmMsg?.trim();
          const confirmation_message = customMsg
            ? applyPlaceholders(customMsg, { nome: clientName, servico: service.name, horario: args.time, profissional: collab.name, data: dateFormatted })
            : `*Agendamento confirmado!* ✅\n\nData: ${dateFormatted}\nHorário: ${args.time}\nServiço: ${service.name}\nProfissional: ${collab.name}`;

          return { success: true, confirmation_message };
        } catch {
          return { error: 'Horário indisponível ou já reservado. Tente outro horário.' };
        }
      }

      case 'list_my_appointments': {
        if (!ctx.clientId) return { appointments: [] };
        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        const appts = await this.prisma.appointment.findMany({
          where: { companyId, clientId: ctx.clientId, scheduledDate: { gte: today }, status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED] } },
          include: { service: { select: { name: true } }, collaborator: { select: { name: true } } },
          orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
          take: 5,
        });
        return { appointments: appts.map((a) => ({ id: a.id, date: a.scheduledDate.toISOString().slice(0, 10).split('-').reverse().join('/'), time: a.scheduledTime, service: a.service.name, collaborator: a.collaborator.name, status: a.status })) };
      }

      case 'cancel_appointment': {
        if (!ctx.clientId) return { error: 'Cliente não identificado.' };
        if (!args.appointment_id) return { error: 'appointment_id obrigatório.' };
        const appt = await this.prisma.appointment.findFirst({
          where: { id: args.appointment_id, companyId, clientId: ctx.clientId },
          include: { service: { select: { name: true } }, collaborator: { select: { name: true } } },
        });
        if (!appt) return { error: 'Agendamento não encontrado.' };
        if (!['SCHEDULED', 'CONFIRMED'].includes(appt.status)) return { error: `Não é possível cancelar com status ${appt.status}.` };
        await this.prisma.appointment.update({
          where: { id: args.appointment_id },
          data: { status: AppointmentStatus.CANCELLED, cancelledAt: new Date(), cancelReason: 'Cancelado pelo cliente via WhatsApp' },
        });
        const dateFormatted = appt.scheduledDate.toISOString().slice(0, 10).split('-').reverse().join('/');
        const customMsg = ctx.config?.cancellationMessage?.trim();
        const cancellation_message = customMsg
          ? applyPlaceholders(customMsg, { nome: ctx.clientName ?? 'Cliente', servico: appt.service.name, horario: appt.scheduledTime, profissional: appt.collaborator.name, data: dateFormatted })
          : `*Agendamento cancelado!*\n\n${dateFormatted} às ${appt.scheduledTime}\n${appt.service.name} com ${appt.collaborator.name}`;
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
        if (!appt) return { found: false, message: 'Nenhum agendamento futuro encontrado.' };
        const dateStr = appt.scheduledDate.toISOString().slice(0, 10);
        const apptDateTime = new Date(`${dateStr}T${appt.scheduledTime}:00`);
        const minutesUntil = differenceInMinutes(apptDateTime, now);
        const hoursUntil = Math.floor(minutesUntil / 60);
        const minsRem = minutesUntil % 60;
        const timeLabel = minutesUntil < 0 ? 'já passou' : minutesUntil < 60 ? `${minutesUntil} minutos` : `${hoursUntil}h${minsRem > 0 ? ` e ${minsRem}min` : ''}`;
        return {
          found: true,
          date: dateStr.split('-').reverse().join('/'),
          time: appt.scheduledTime,
          service: appt.service.name,
          collaborator: appt.collaborator.name,
          time_until: timeLabel,
          reminder_info: ctx.config?.reminderHoursBefore ? `Lembrete ${ctx.config.reminderHoursBefore}h antes.` : null,
        };
      }

      default:
        return { error: `Ferramenta desconhecida: ${toolName}` };
    }
  }
}
