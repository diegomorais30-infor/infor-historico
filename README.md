# InforGest

Sistema de gestão de equipamentos e manutenções (Next.js + Supabase), multiempresa.
Uso interno da Infor Cartuchos e base para vender por mensalidade a outras empresas.

## O que o sistema faz
- Login, criação de conta e convite de equipe por e-mail (perfis: administrador, gerente e técnico)
- Cada empresa vê somente os próprios dados (regras de acesso no banco)
- Clientes e equipamentos, com código automático IC-EQP-000001 e QR code por equipamento
- Página pública do QR code (sem login) com dados da máquina e histórico de manutenções
- Registro de manutenção com peças usadas, fotos e PDFs; o estoque da peça baixa sozinho
- Peças e suprimentos com estoque mínimo e aviso de reposição
- Início com preventivas dos próximos 30 dias, peças para repor e plano da empresa
- Limite de impressoras por plano (teste: 7 dias e até 5 impressoras)
- Chamados pelo QR code: o cliente pede manutenção na página da impressora (gera protocolo CH-000001 e abre o WhatsApp da empresa); a equipe atende na tela Chamados
- Contratos de locação: mensalidade, franquia P&B/cor, excedente, vigência e reajuste; impressoras vinculadas ao contrato
- Leituras mensais dos contadores (recusa número menor que o anterior)
- Fechar mês: calcula páginas, excedente e total e gera a fatura do contrato

## Configuração
1. Instale Node.js 20+.
2. Copie `.env.example` para `.env.local` e preencha as três variáveis.
3. `npm install`
4. `npm run dev` e abra http://localhost:3000

No Vercel, cadastre as mesmas variáveis em Settings → Environment Variables.
`NEXT_PUBLIC_SITE_URL` deve ser o endereço definitivo (de preferência domínio próprio): ele fica gravado dentro do QR code impresso.

## Banco de dados (Supabase, projeto `infor-historico`)
Tabelas: `companies`, `company_invites`, `profiles`, `clients`, `equipment`, `maintenance`, `parts`,
`maintenance_parts`, `maintenance_files`, `contracts`, `meter_readings`, `invoices`, `service_requests`. Pasta de arquivos privada: `maintenance-files`.
As funções públicas `get_public_equipment(token)` e `create_service_request(...)` alimentam a página do QR code (a segunda limita 3 pedidos por hora por impressora).

## Pendências conhecidas
- Portal do cliente (envio de leitura e chamados), ordens de serviço de balcão, precificador e financeiro (contas a receber)
- Bloqueio automático quando o período de teste termina
- Ligar a proteção contra senhas vazadas no painel do Supabase (Authentication)
- Etiqueta do QR code para impressão
