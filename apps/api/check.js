const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function testReplace(label, template) {
  if (!template) {
    console.log(`  ${label}: [NULL/EMPTY] → substitution skipped`);
    return;
  }
  const result = template
    .replace(/{\s*nome\s*}/gi, 'João')
    .replace(/{\s*servico\s*}/gi, 'Corte')
    .replace(/{\s*horario\s*}/gi, '10:00')
    .replace(/{\s*profissional\s*}/gi, 'Maria')
    .replace(/{\s*data\s*}/gi, '25/05/2026');
  const changed = result !== template;
  console.log(`  ${label}: ${changed ? '✅ REPLACED' : '❌ NOT REPLACED'}`);
  console.log(`    raw:    ${JSON.stringify(template.slice(0, 100))}`);
  console.log(`    result: ${JSON.stringify(result.slice(0, 100))}`);
  // Show char codes of first brace found
  const braceIdx = template.indexOf('{');
  if (braceIdx !== -1) {
    console.log(`    first '{' charCode: ${template.charCodeAt(braceIdx)} (expected 123)`);
  }
}

async function main() {
  const configs = await prisma.whatsappConfig.findMany();
  for (const c of configs) {
    console.log('=== companyId:', c.companyId, '===');
    testReplace('scheduleConfirmMsg', c.scheduleConfirmMsg);
    testReplace('reminderMessage   ', c.reminderMessage);
    console.log('  reminderRules:', JSON.stringify(c.reminderRules));
    console.log('  dailyReminderEnabled:', c.dailyReminderEnabled);
    console.log('');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
