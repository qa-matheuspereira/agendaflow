import { z } from 'zod';

// ─── AUTH ────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
});
export type LoginFormData = z.infer<typeof loginSchema>;

// ─── CLIENTS ─────────────────────────────────────────────────────────────────
export const createClientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  whatsappNumber: z
    .string()
    .regex(/^55\d{10,11}$/, 'Formato: 5511999999999'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  birthdate: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});
export type CreateClientFormData = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial();
export type UpdateClientFormData = z.infer<typeof updateClientSchema>;

// ─── COLLABORATORS ───────────────────────────────────────────────────────────
export const createCollaboratorSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  whatsappNumber: z
    .string()
    .regex(/^55\d{10,11}$/, 'Formato: 5511999999999'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  bio: z.string().optional().or(z.literal('')),
  serviceIds: z.array(z.string()).optional(),
});
export type CreateCollaboratorFormData = z.infer<typeof createCollaboratorSchema>;

export const updateCollaboratorSchema = createCollaboratorSchema.partial();
export type UpdateCollaboratorFormData = z.infer<typeof updateCollaboratorSchema>;

// ─── SERVICES ────────────────────────────────────────────────────────────────
export const createServiceSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  description: z.string().optional().or(z.literal('')),
  categoryId: z.string().optional().or(z.literal('')),
  durationMinutes: z.coerce.number().min(1, 'Duração mínima: 1 minuto'),
  breakAfterMinutes: z.coerce.number().min(0).optional(),
  price: z.coerce.number().min(0, 'Preço deve ser positivo'),
  requiresDocument: z.boolean().optional(),
  documentInstruction: z.string().optional().or(z.literal('')),
  requiresAdvancePayment: z.boolean().optional(),
  advancePaymentType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  advancePaymentValue: z.coerce.number().min(0).optional(),
  maxDailyAppointments: z.coerce.number().min(1).optional(),
  order: z.coerce.number().min(0).optional(),
});
export type CreateServiceFormData = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.partial();
export type UpdateServiceFormData = z.infer<typeof updateServiceSchema>;

// ─── APPOINTMENTS ────────────────────────────────────────────────────────────
export const createAppointmentSchema = z.object({
  clientId: z.string().uuid('Selecione um cliente'),
  collaboratorId: z.string().uuid('Selecione um colaborador'),
  serviceId: z.string().uuid('Selecione um serviço'),
  scheduledDate: z.string().min(1, 'Selecione uma data'),
  scheduledTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato: HH:MM'),
  notes: z.string().optional().or(z.literal('')),
});
export type CreateAppointmentFormData = z.infer<typeof createAppointmentSchema>;

export const cancelAppointmentSchema = z.object({
  reason: z.string().optional().or(z.literal('')),
});
export type CancelAppointmentFormData = z.infer<typeof cancelAppointmentSchema>;
