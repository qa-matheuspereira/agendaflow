import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { CreateServicePackageDto } from './dto/create-service-package.dto';
import { PurchasePackageDto } from './dto/purchase-package.dto';
import { ClientPackageStatus, PackagePaymentStatus, CreditMode } from '@prisma/client';
import { NotificationType } from '@agendaflow/shared';
import { addDays } from 'date-fns';

@Injectable()
export class PackagesService {
  private readonly logger = new Logger(PackagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── ServicePackage (empresa gerencia) ───────────────────────────────────

  async listPackages(companyId: string) {
    return this.prisma.servicePackage.findMany({
      where: { companyId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createPackage(companyId: string, dto: CreateServicePackageDto) {
    return this.prisma.servicePackage.create({
      data: {
        companyId,
        name: dto.name,
        description: dto.description,
        credits: dto.credits,
        price: dto.price,
        validityDays: dto.validityDays,
        creditMode: dto.creditMode ?? CreditMode.PER_VISIT,
        serviceIds: dto.serviceIds ?? [],
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updatePackage(companyId: string, id: string, dto: Partial<CreateServicePackageDto>) {
    await this.findPackageOrThrow(companyId, id);
    return this.prisma.servicePackage.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.credits !== undefined && { credits: dto.credits }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.validityDays !== undefined && { validityDays: dto.validityDays }),
        ...(dto.creditMode !== undefined && { creditMode: dto.creditMode }),
        ...(dto.serviceIds !== undefined && { serviceIds: dto.serviceIds }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deactivatePackage(companyId: string, id: string) {
    await this.findPackageOrThrow(companyId, id);
    return this.prisma.servicePackage.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async findPackageOrThrow(companyId: string, id: string) {
    const pkg = await this.prisma.servicePackage.findFirst({ where: { id, companyId } });
    if (!pkg) throw new NotFoundException('Pacote não encontrado');
    return pkg;
  }

  // ─── ClientPackage ────────────────────────────────────────────────────────

  async getClientPackages(companyId: string, clientId: string) {
    return this.prisma.clientPackage.findMany({
      where: { companyId, clientId, status: ClientPackageStatus.ACTIVE },
      include: { package: true },
      orderBy: { expiresAt: 'asc' },
    });
  }

  async listActiveClientPackages(companyId: string) {
    return this.prisma.clientPackage.findMany({
      where: { companyId, status: ClientPackageStatus.ACTIVE },
      include: {
        client: { select: { id: true, name: true, whatsappNumber: true } },
        package: { select: { id: true, name: true, credits: true, creditMode: true } },
      },
      orderBy: { expiresAt: 'asc' },
    });
  }

  async purchasePackage(companyId: string, dto: PurchasePackageDto) {
    const pkg = await this.prisma.servicePackage.findFirst({
      where: { id: dto.packageId, companyId, isActive: true },
    });
    if (!pkg) throw new NotFoundException('Pacote não encontrado ou inativo');

    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, companyId },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado');

    const existing = await this.prisma.clientPackage.findFirst({
      where: { companyId, clientId: dto.clientId, packageId: dto.packageId, status: ClientPackageStatus.ACTIVE },
    });
    if (existing) throw new BadRequestException('Cliente já possui este pacote ativo');

    const clientPackage = await this.prisma.clientPackage.create({
      data: {
        companyId,
        clientId: dto.clientId,
        packageId: dto.packageId,
        creditsTotal: pkg.credits,
        creditsUsed: 0,
        expiresAt: addDays(new Date(), pkg.validityDays),
        status: ClientPackageStatus.ACTIVE,
        paymentStatus: PackagePaymentStatus.PAID, // manual purchase — admin activates directly
      },
      include: { package: true, client: true },
    });

    this.logger.log(`Package ${pkg.name} activated for client ${client.name} (${companyId})`);

    // Notify client via WhatsApp
    void this.notifyClient(companyId, client.whatsappNumber, client.id, NotificationType.PACKAGE_ACTIVATED,
      `Olá ${client.name}! Seu pacote *${pkg.name}* foi ativado com sucesso. Você tem ${pkg.credits} crédito(s) válidos por ${pkg.validityDays} dias.`);

    return clientPackage;
  }

  async cancelClientPackage(companyId: string, clientPackageId: string) {
    const cp = await this.prisma.clientPackage.findFirst({
      where: { id: clientPackageId, companyId },
    });
    if (!cp) throw new NotFoundException('Pacote do cliente não encontrado');

    return this.prisma.clientPackage.update({
      where: { id: clientPackageId },
      data: { status: ClientPackageStatus.CANCELLED },
    });
  }

  async extendClientPackage(companyId: string, clientPackageId: string, days: number) {
    const cp = await this.prisma.clientPackage.findFirst({
      where: { id: clientPackageId, companyId },
    });
    if (!cp) throw new NotFoundException('Pacote do cliente não encontrado');

    return this.prisma.clientPackage.update({
      where: { id: clientPackageId },
      data: { expiresAt: addDays(cp.expiresAt, days) },
    });
  }

  // ─── Credit deduction ────────────────────────────────────────────────────

  async findActivePackageForService(companyId: string, clientId: string, serviceId: string) {
    const now = new Date();
    const packages = await this.prisma.clientPackage.findMany({
      where: {
        companyId,
        clientId,
        status: ClientPackageStatus.ACTIVE,
        paymentStatus: PackagePaymentStatus.PAID,
        expiresAt: { gt: now },
      },
      include: { package: true },
      orderBy: { expiresAt: 'asc' },
    });

    // Find first package that covers the service
    return packages.find((cp) => {
      const { serviceIds } = cp.package;
      return serviceIds.length === 0 || serviceIds.includes(serviceId);
    }) ?? null;
  }

  async debitCredit(
    clientPackageId: string,
    bookingSessionId: string,
    companyId: string,
  ): Promise<{ creditsLeft: number; exhausted: boolean }> {
    const cp = await this.prisma.clientPackage.findFirst({
      where: { id: clientPackageId, companyId, status: ClientPackageStatus.ACTIVE },
      include: { package: true },
    });
    if (!cp) throw new BadRequestException('Pacote não encontrado ou inativo');
    if (cp.creditsUsed >= cp.creditsTotal) throw new BadRequestException('Pacote sem créditos');

    // PER_VISIT: only debit once per bookingSessionId
    if (cp.package.creditMode === CreditMode.PER_VISIT) {
      const alreadyDebited = await this.prisma.appointment.findFirst({
        where: { clientPackageId, bookingSessionId },
      });
      if (alreadyDebited) {
        return { creditsLeft: cp.creditsTotal - cp.creditsUsed, exhausted: false };
      }
    }

    const newUsed = cp.creditsUsed + 1;
    const exhausted = newUsed >= cp.creditsTotal;

    const updated = await this.prisma.clientPackage.update({
      where: { id: clientPackageId },
      data: {
        creditsUsed: newUsed,
        ...(exhausted && { status: ClientPackageStatus.EXHAUSTED }),
      },
      include: { client: true, package: true },
    });

    const creditsLeft = cp.creditsTotal - newUsed;

    if (exhausted) {
      void this.notifyClient(companyId, updated.client.whatsappNumber, updated.client.id,
        NotificationType.PACKAGE_EXHAUSTED,
        `Olá ${updated.client.name}! Seu pacote *${updated.package.name}* foi totalmente utilizado. Entre em contato para renovar.`);
    } else if (creditsLeft === 1) {
      void this.notifyClient(companyId, updated.client.whatsappNumber, updated.client.id,
        NotificationType.PACKAGE_LOW_CREDITS,
        `Olá ${updated.client.name}! Seu pacote *${updated.package.name}* tem apenas 1 crédito restante.`);
    }

    return { creditsLeft, exhausted };
  }

  // ─── Expiry check (called by scheduler) ─────────────────────────────────

  async expireOldPackages(): Promise<{ expired: number; notified: number }> {
    const now = new Date();
    const expired = await this.prisma.clientPackage.findMany({
      where: { status: ClientPackageStatus.ACTIVE, expiresAt: { lt: now } },
      include: { client: true, package: true },
    });

    if (expired.length === 0) return { expired: 0, notified: 0 };

    await this.prisma.clientPackage.updateMany({
      where: { id: { in: expired.map((cp) => cp.id) } },
      data: { status: ClientPackageStatus.EXPIRED },
    });

    let notified = 0;
    for (const cp of expired) {
      void this.notifyClient(cp.companyId, cp.client.whatsappNumber, cp.client.id,
        NotificationType.PACKAGE_EXPIRED,
        `Olá ${cp.client.name}! Seu pacote *${cp.package.name}* expirou. Adquira um novo pacote para continuar aproveitando nossos serviços.`);
      notified++;
    }

    return { expired: expired.length, notified };
  }

  async notifyExpiringPackages(daysAhead: number = 3): Promise<number> {
    const now = new Date();
    const cutoff = addDays(now, daysAhead);

    const expiring = await this.prisma.clientPackage.findMany({
      where: {
        status: ClientPackageStatus.ACTIVE,
        expiresAt: { gt: now, lte: cutoff },
      },
      include: { client: true, package: true },
    });

    let notified = 0;
    for (const cp of expiring) {
      const daysLeft = Math.ceil((cp.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      void this.notifyClient(cp.companyId, cp.client.whatsappNumber, cp.client.id,
        NotificationType.PACKAGE_EXPIRING,
        `Olá ${cp.client.name}! Seu pacote *${cp.package.name}* vence em ${daysLeft} dia(s). Renove agora para não perder seus créditos.`);
      notified++;
    }

    return notified;
  }

  private async notifyClient(
    companyId: string,
    whatsappNumber: string,
    clientId: string,
    type: NotificationType,
    message: string,
  ): Promise<void> {
    const waCfg = await this.prisma.whatsappConfig.findUnique({
      where: { companyId },
      select: { instanceName: true, isConnected: true },
    });
    if (!waCfg?.isConnected) return;

    await this.notifications.enqueueWhatsapp({
      companyId,
      instanceName: waCfg.instanceName,
      toNumber: whatsappNumber,
      message,
      type,
      clientId,
    });
  }
}
