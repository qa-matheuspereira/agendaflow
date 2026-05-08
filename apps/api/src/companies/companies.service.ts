import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { AuditService } from '@/audit/audit.service';
import { AuditAction, UserRole } from '@agendaflow/shared';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import * as bcrypt from 'bcryptjs';
import { PlanType, CompanyStatus } from '@prisma/client';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateCompanyDto, creatorId: string) {
    const exists = await this.prisma.company.findUnique({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException(`Slug '${dto.slug}' já está em uso`);

    const emailExists = await this.prisma.company.findUnique({ where: { email: dto.email } });
    if (emailExists) throw new ConflictException(`Email '${dto.email}' já cadastrado`);

    const company = await this.prisma.company.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        email: dto.email,
        phone: dto.phone,
        document: dto.document,
        schedulingMode: dto.schedulingMode ?? 'HYBRID',
        timezone: dto.timezone ?? 'America/Sao_Paulo',
        planType: PlanType.TRIAL,
        status: CompanyStatus.TRIAL,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 dias
      },
    });

    // Cria regras padrão para o tenant
    await this.prisma.businessRules.create({
      data: {
        companyId: company.id,
        cancellationAllowed: true,
        cancellationMinHours: 2,
        autoBlockEnabled: false,
        requireConfirmation: true,
        confirmationDeadlineHours: 24,
      },
    });

    await this.audit.log({
      companyId: company.id,
      userId: creatorId,
      action: AuditAction.SETTINGS_UPDATED,
      entity: 'Company',
      entityId: company.id,
      newValue: { name: company.name, slug: company.slug },
    });

    return company;
  }

  async findAll(requestingUserId?: string) {
    // Apenas SUPER_ADMIN lista todas as empresas
    return this.prisma.company.findMany({
      select: {
        id: true, name: true, slug: true, email: true, phone: true,
        planType: true, status: true, schedulingMode: true, createdAt: true,
        _count: { select: { collaborators: true, clients: true, appointments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        businessRules: true,
        whatsappConfig: { select: { instanceName: true, isConnected: true, phoneNumber: true } },
        mercadopagoConfig: { select: { isActive: true } },
        _count: { select: { collaborators: true, clients: true, appointments: true } },
      },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }

  async findBySlug(slug: string) {
    const company = await this.prisma.company.findUnique({ where: { slug } });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto, userId: string) {
    const company = await this.findOne(id);
    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        document: dto.document,
        schedulingMode: dto.schedulingMode,
        timezone: dto.timezone,
      },
    });
    await this.audit.log({
      companyId: id,
      userId,
      action: AuditAction.SETTINGS_UPDATED,
      entity: 'Company',
      entityId: id,
      oldValue: { name: company.name, email: company.email },
      newValue: { name: updated.name, email: updated.email },
    });
    return updated;
  }

  async getStats(companyId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalClients, totalCollaborators, totalAppointmentsToday, queueToday] = await Promise.all([
      this.prisma.client.count({ where: { companyId, isBlocked: false } }),
      this.prisma.collaborator.count({ where: { companyId, isActive: true } }),
      this.prisma.appointment.count({
        where: { companyId, scheduledDate: { gte: today, lt: tomorrow } },
      }),
      this.prisma.queueEntry.count({
        where: { companyId, status: { in: ['WAITING', 'CALLED', 'IN_SERVICE'] } },
      }),
    ]);

    return { totalClients, totalCollaborators, totalAppointmentsToday, queueToday };
  }
}
