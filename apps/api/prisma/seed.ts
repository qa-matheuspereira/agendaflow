import { PrismaClient, UserRole, PlanType, CompanyStatus, SchedulingMode, DayOfWeek } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Super Admin Company (plataforma)
  const platformCompany = await prisma.company.upsert({
    where: { slug: 'agendaflow-platform' },
    update: {},
    create: {
      name: 'AgendaFlow Platform',
      slug: 'agendaflow-platform',
      email: 'platform@agendaflow.com.br',
      planType: PlanType.ENTERPRISE,
      status: CompanyStatus.ACTIVE,
      schedulingMode: SchedulingMode.HYBRID,
      timezone: 'America/Sao_Paulo',
    },
  });

  const superAdminPassword = await bcrypt.hash(
    process.env.SUPER_ADMIN_PASSWORD ?? 'Admin@123',
    12,
  );

  await prisma.user.upsert({
    where: { companyId_email: { companyId: platformCompany.id, email: process.env.SUPER_ADMIN_EMAIL ?? 'super@agendaflow.com.br' } },
    update: {},
    create: {
      companyId: platformCompany.id,
      name: 'Super Admin',
      email: process.env.SUPER_ADMIN_EMAIL ?? 'super@agendaflow.com.br',
      passwordHash: superAdminPassword,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  // Empresa demo
  const demoCompany = await prisma.company.upsert({
    where: { slug: 'barbearia-demo' },
    update: {},
    create: {
      name: 'Barbearia Demo',
      slug: 'barbearia-demo',
      email: 'admin@barbeariademo.com.br',
      phone: '11999999999',
      planType: PlanType.PRO,
      status: CompanyStatus.ACTIVE,
      schedulingMode: SchedulingMode.HYBRID,
      timezone: 'America/Sao_Paulo',
    },
  });

  const adminPassword = await bcrypt.hash('Admin@123', 12);

  await prisma.user.upsert({
    where: { companyId_email: { companyId: demoCompany.id, email: 'admin@barbeariademo.com.br' } },
    update: {},
    create: {
      companyId: demoCompany.id,
      name: 'Admin Demo',
      email: 'admin@barbeariademo.com.br',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  // Categorias de serviço demo
  const category = await prisma.serviceCategory.create({
    data: {
      companyId: demoCompany.id,
      name: 'Cabelo',
      color: '#3B82F6',
      icon: 'scissors',
      order: 1,
    },
  });

  // Serviços demo
  await prisma.service.createMany({
    data: [
      {
        companyId: demoCompany.id,
        categoryId: category.id,
        name: 'Corte',
        description: 'Corte tradicional',
        durationMinutes: 30,
        breakAfterMinutes: 10,
        price: 45.00,
        isActive: true,
        order: 1,
      },
      {
        companyId: demoCompany.id,
        categoryId: category.id,
        name: 'Barba',
        description: 'Barba na navalha',
        durationMinutes: 20,
        breakAfterMinutes: 5,
        price: 30.00,
        isActive: true,
        order: 2,
      },
      {
        companyId: demoCompany.id,
        categoryId: category.id,
        name: 'Corte + Barba',
        description: 'Combo corte e barba',
        durationMinutes: 50,
        breakAfterMinutes: 10,
        price: 65.00,
        isActive: true,
        order: 3,
      },
    ],
    skipDuplicates: true,
  });

  // Horários de funcionamento demo (seg-sab)
  const workDays = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY,
  ];

  for (const day of workDays) {
    await prisma.businessHour.create({
      data: {
        companyId: demoCompany.id,
        dayOfWeek: day,
        openTime: '09:00',
        closeTime: day === DayOfWeek.SATURDAY ? '17:00' : '19:00',
        isOpen: true,
        slotDurationMin: 30,
      },
    });
  }

  await prisma.businessHour.create({
    data: {
      companyId: demoCompany.id,
      dayOfWeek: DayOfWeek.SUNDAY,
      openTime: '09:00',
      closeTime: '12:00',
      isOpen: false,
      slotDurationMin: 30,
    },
  });

  // Regras de negócio demo
  await prisma.businessRules.upsert({
    where: { companyId: demoCompany.id },
    update: {},
    create: {
      companyId: demoCompany.id,
      cancellationAllowed: true,
      cancellationMinHours: 2,
      autoBlockEnabled: true,
      autoBlockAfterAbsences: 3,
      autoBlockWindowDays: 30,
      autoReturnEnabled: true,
      autoReturnAfterDays: 30,
      requireConfirmation: true,
      confirmationDeadlineHours: 24,
    },
  });

  console.log('✅ Seed concluído com sucesso!');
  console.log(`📧 Super Admin: ${process.env.SUPER_ADMIN_EMAIL ?? 'super@agendaflow.com.br'}`);
  console.log(`📧 Demo Admin: admin@barbeariademo.com.br / Admin@123`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
