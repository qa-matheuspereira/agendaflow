// seed.js — script de seed em JS puro para uso no Docker runner
// Não depende de TypeScript/ts-node
'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  const superEmail = process.env.SUPER_ADMIN_EMAIL ?? 'super@agendaflow.com.br';
  const superPassword = process.env.SUPER_ADMIN_PASSWORD ?? 'Admin@123';

  // Platform company (super admin)
  const platformCompany = await prisma.company.upsert({
    where: { slug: 'agendaflow-platform' },
    update: {},
    create: {
      name: 'AgendaFlow Platform',
      slug: 'agendaflow-platform',
      email: 'platform@agendaflow.com.br',
      planType: 'ENTERPRISE',
      status: 'ACTIVE',
      schedulingMode: 'HYBRID',
      timezone: 'America/Sao_Paulo',
    },
  });

  const superHash = await bcrypt.hash(superPassword, 12);

  await prisma.user.upsert({
    where: { companyId_email: { companyId: platformCompany.id, email: superEmail } },
    update: {},
    create: {
      companyId: platformCompany.id,
      name: 'Super Admin',
      email: superEmail,
      passwordHash: superHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log(`✅ Super Admin criado: ${superEmail}`);

  // Empresa demo
  const demoCompany = await prisma.company.upsert({
    where: { slug: 'barbearia-demo' },
    update: {},
    create: {
      name: 'Barbearia Demo',
      slug: 'barbearia-demo',
      email: 'admin@barbeariademo.com.br',
      phone: '11999999999',
      planType: 'PRO',
      status: 'ACTIVE',
      schedulingMode: 'HYBRID',
      timezone: 'America/Sao_Paulo',
    },
  });

  const adminHash = await bcrypt.hash('Admin@123', 12);

  await prisma.user.upsert({
    where: { companyId_email: { companyId: demoCompany.id, email: 'admin@barbeariademo.com.br' } },
    update: {},
    create: {
      companyId: demoCompany.id,
      name: 'Admin Demo',
      email: 'admin@barbeariademo.com.br',
      passwordHash: adminHash,
      role: 'ADMIN',
      isActive: true,
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

  // WhatsApp config — necessário para os endpoints /settings/whatsapp/*
  const superInstanceName = `agendaflow-${platformCompany.id.substring(0, 8)}`;
  const demoInstanceName = `barbearia-${demoCompany.id.substring(0, 8)}`;

  await prisma.whatsappConfig.upsert({
    where: { companyId: platformCompany.id },
    update: {},
    create: {
      companyId: platformCompany.id,
      instanceName: superInstanceName,
      isConnected: false,
      greetingMessage: 'Olá! Bem-vindo ao AgendaFlow. Como posso ajudar?',
      scheduleConfirmMsg: 'Seu agendamento foi confirmado para {{data}} às {{hora}}.',
      reminderMessage: 'Lembrete: você tem um agendamento amanhã às {{hora}}.',
      cancellationMessage: 'Seu agendamento foi cancelado. Entre em contato para reagendar.',
      queueCalledMessage: 'É a sua vez! Por favor, dirija-se ao atendimento.',
    },
  });

  await prisma.whatsappConfig.upsert({
    where: { companyId: demoCompany.id },
    update: {},
    create: {
      companyId: demoCompany.id,
      instanceName: demoInstanceName,
      isConnected: false,
      greetingMessage: 'Olá! Bem-vindo à Barbearia Demo. Como posso ajudar?',
      scheduleConfirmMsg: 'Seu agendamento foi confirmado para {{data}} às {{hora}}.',
      reminderMessage: 'Lembrete: você tem um agendamento amanhã às {{hora}}.',
      cancellationMessage: 'Seu agendamento foi cancelado. Entre em contato para reagendar.',
      queueCalledMessage: 'É a sua vez! Por favor, dirija-se ao atendimento.',
    },
  });

  console.log('✅ Seed concluído!');
  console.log(`📧 Login: ${superEmail} / ${superPassword}`);
  console.log('📧 Demo:  admin@barbeariademo.com.br / Admin@123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e.message);
    // Não falha o startup por erro de seed (dados já podem existir)
    process.exit(0);
  })
  .finally(() => prisma.$disconnect());
