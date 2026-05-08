# FASE 4A — TESTE + CORREÇÃO AUTOMÁTICA

Escolha **Thorough testing com cobertura completa**.

Não quero apenas listagem de cenários.

Execute uma **auditoria funcional e estrutural completa** de todas as áreas abaixo:

- autenticação
- dashboard
- agendamentos
- fila realtime
- clientes
- colaboradores
- serviços
- horários/pausas
- regras/config
- relatórios
- whatsapp config
- mercado pago config
- audit logs
- formulários zod
- tanstack query
- axios endpoints
- socket
- build next
- tipagem typescript

---

## REGRA PRINCIPAL

Para cada problema encontrado:

1. corrigir imediatamente
2. mostrar arquivos alterados
3. revalidar o fluxo corrigido

---

## NÃO QUERO APENAS RELATÓRIO DE BUGS

Quero ciclo completo de execução:

**TESTAR → CORRIGIR → VALIDAR → CONTINUAR**

---

## CRITÉRIOS PARA ENCERRAR A FASE

Somente encerrar quando:

- frontend estiver funcionalmente coerente
- sem mocks
- sem hooks quebrados
- sem endpoint divergente
- sem erros lógicos aparentes de build

---

## MODO DE EXECUÇÃO

Executar em modo contínuo.

Não pedir novas confirmações intermediárias.