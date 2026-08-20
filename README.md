# Infor Histórico — V1

Aplicação Next.js + Supabase para a Infor Cartuchos.

## O que já está preparado
- Login por e-mail e senha
- Dashboard
- Consulta de clientes
- Cadastro de equipamentos
- Código automático IC-EQP-000001 gerado pelo banco
- QR token por equipamento
- Página de equipamento
- QR Code real
- Página acessível pelo QR Code
- Histórico de manutenções (leitura)

## Configuração
1. Instale Node.js 20+.
2. Copie `.env.example` para `.env.local`.
3. Preencha:
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
4. Rode `npm install`.
5. Rode `npm run dev`.
6. Abra http://localhost:3000

O banco Supabase deve ser o projeto `infor-historico` e o SQL da V1 já deve ter sido executado.

## Próxima etapa
Adicionar cadastro de clientes, registro de manutenção, upload de fotos, etiqueta para impressão, permissões por perfil e página pública com acesso seguro.
