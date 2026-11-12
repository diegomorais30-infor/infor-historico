import "./globals.css";
import { Logo } from "@/components/logo";
import { NOME_PRODUTO } from "@/lib/marca";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";
import InstalarApp from "@/components/instalar-app";
import { podeVer } from "@/lib/permissoes";
import MenuLateral, { type ItemMenu } from "@/components/menu-lateral";

export const viewport = { themeColor: "#0a1a33" };

export const metadata = {
  appleWebApp: { capable: true, title: NOME_PRODUTO, statusBarStyle: "black-translucent" as const },
  title: NOME_PRODUTO,
  description: "Gestão de equipamentos e manutenções",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let empresa = "";
  let papel = "";
  let perms: any = {};
  let abertos = 0;
  if (user) {
    const { count } = await supabase
      .from("service_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "open");
    abertos = count ?? 0;
    const { data } = await supabase
      .from("profiles")
      .select("role, permissions, companies(name)")
      .eq("id", user.id)
      .single();
    empresa = (data as any)?.companies?.name ?? "";
    papel = (data as any)?.role ?? "";
    perms = (data as any)?.permissions ?? {};
  }

  let osTodas = 0;
  let osTrab = 0;
  if (user) {
    const r1 = await supabase.from("service_orders").select("*", { count: "exact", head: true });
    const r2 = await supabase.from("service_orders").select("*", { count: "exact", head: true }).in("status", ["entrada", "orcamento", "aberto", "andamento", "pausado"]);
    osTodas = r1.count ?? 0;
    osTrab = r2.count ?? 0;
  }

  const v = (a: string) => podeVer(papel, perms, a as any);
  const M = (href: string, nome: string, icone: string, ok: boolean, extra: Partial<ItemMenu> = {}) => ok && ({ href, nome, icone, ...extra } as ItemMenu);
  const A = "Atendimento", C = "Cadastros", G = "Gestão";
  const itens: ItemMenu[] = user
    ? ([
        // ATENDIMENTO
        M("/dashboard", "Início", "🏠", true, { secao: A }),
        M("/tarefas", "Tarefas", "✅", true, { secao: A }),
        M("/chamados", "Chamados", "📩", v("chamados"), { badge: abertos, secao: A }),
        M("/orcamentos", "Lista de orçamentos", "📝", v("os"), { grupo: "Orçamentos", sub: true, secao: A }),
        M("/modulo/modelos-orcamento", "Modelos de orçamento", "📄", v("os"), { grupo: "Orçamentos", sub: true, secao: A }),
        M("/os", "Todas", "🛠️", v("os"), { grupo: "Ordens de serviço", sub: true, secao: A, contagem: osTodas }),
        M("/os?status=trabalhando", "Trabalhando", "⚡", v("os"), { grupo: "Ordens de serviço", sub: true, secao: A, contagem: osTrab }),
        M("/os?status=entrada", "Entrada", "📥", v("os"), { grupo: "Ordens de serviço", sub: true, secao: A }),
        M("/os?status=orcamento", "Orçamento", "📝", v("os"), { grupo: "Ordens de serviço", sub: true, secao: A }),
        M("/os?status=aberto", "Aberto", "🟢", v("os"), { grupo: "Ordens de serviço", sub: true, secao: A }),
        M("/os?status=andamento", "Andamento", "🔧", v("os"), { grupo: "Ordens de serviço", sub: true, secao: A }),
        M("/os?status=pausado", "Pausado", "⏸️", v("os"), { grupo: "Ordens de serviço", sub: true, secao: A }),
        M("/os?status=concluido", "Concluído", "✔️", v("os"), { grupo: "Ordens de serviço", sub: true, secao: A }),
        M("/os?status=faturado", "Faturado", "💵", v("os"), { grupo: "Ordens de serviço", sub: true, secao: A }),
        M("/os?status=finalizado", "Finalizado", "🏁", v("os"), { grupo: "Ordens de serviço", sub: true, secao: A }),
        M("/os?status=cancelado", "Cancelado", "🚫", v("os"), { grupo: "Ordens de serviço", sub: true, secao: A }),
        M("/garantias", "Garantias", "🛡️", v("os"), { secao: A }),
        M("/vendas", "Vendas", "🧾", v("financeiro"), { secao: A }),
        M("/contratos", "Contratos de locação", "📄", v("contratos"), { secao: A }),
        M("/leituras", "Leituras", "📊", v("leituras"), { secao: A }),
        // CADASTROS
        M("/clientes", "Clientes", "👥", v("clientes"), { secao: C }),
        M("/fornecedores", "Fornecedores", "🚚", v("financeiro"), { secao: C }),
        M("/equipamentos", "Equipamentos", "🖨️", v("equipamentos"), { secao: C }),
        M("/equipamentos/etiquetas", "Imprimir QR / etiquetas", "🏷️", v("equipamentos"), { secao: C }),
        M("/ler-qr", "Ler QR", "📷", v("equipamentos"), { secao: C }),
        M("/servicos", "Serviços", "🧰", v("os"), { secao: C }),
        M("/estoque", "Cadastrados", "📦", v("pecas"), { grupo: "Produtos", sub: true, secao: C }),
        M("/kits", "Kits", "🧩", v("pecas"), { grupo: "Produtos", sub: true, secao: C }),
        M("/cadastros/movimentacao", "Movimentação", "🔁", v("pecas"), { grupo: "Produtos", sub: true, secao: C }),
        M("/modulo/historico-estoque", "Histórico (Inforos)", "🕘", v("pecas"), { grupo: "Produtos", sub: true, secao: C }),
        M("/cadastros/consumo-interno", "Consumo interno", "🧴", v("pecas"), { grupo: "Produtos", sub: true, secao: C }),
        M("/cadastros/grupos", "Grupos", "🗂️", v("pecas"), { grupo: "Produtos", sub: true, secao: C }),
        M("/cadastros/listas-de-precos", "Listas de preços", "🏷️", v("pecas"), { grupo: "Produtos", sub: true, secao: C }),
        M("/compras", "Compras", "🛒", v("pecas"), { secao: C }),
        // GESTÃO
        M("/financeiro", "Faturas / lançamentos", "💰", v("financeiro"), { grupo: "Financeiro", sub: true, secao: G }),
        M("/cadastros/transferencias", "Transferências", "↔️", v("financeiro"), { grupo: "Financeiro", sub: true, secao: G }),
        M("/extratos", "Extratos", "📃", v("financeiro"), { grupo: "Financeiro", sub: true, secao: G }),
        M("/financeiro/fluxo", "Fluxo de caixa", "📈", v("financeiro"), { grupo: "Financeiro", sub: true, secao: G }),
        M("/dre", "DRE", "📑", v("financeiro"), { grupo: "Financeiro", sub: true, secao: G }),
        M("/metricas", "Métricas", "📊", v("financeiro"), { grupo: "Financeiro", sub: true, secao: G }),
        M("/comissoes", "Comissões", "🤝", v("financeiro"), { grupo: "Financeiro", sub: true, secao: G }),
        M("/financeiro/configuracoes", "Configurações", "⚙️", v("financeiro"), { grupo: "Financeiro", sub: true, secao: G }),
        M("/notas-fiscais", "Notas fiscais", "🧮", v("financeiro"), { grupo: "Notas fiscais", sub: true, secao: G }),
        M("/notas-fiscais/config", "Configurações de NF", "🧾", v("financeiro"), { grupo: "Notas fiscais", sub: true, secao: G }),
        M("/notas-fiscais/tipos", "Tipos de serviço (NFS-e)", "🏷️", v("financeiro"), { grupo: "Notas fiscais", sub: true, secao: G }),
        M("/relatorios/clientes", "Clientes", "👥", true, { grupo: "Relatórios", sub: true, secao: G }),
        M("/relatorios/equipamentos", "Equipamentos", "🖨️", true, { grupo: "Relatórios", sub: true, secao: G }),
        M("/relatorios/servicos", "Serviços", "🧰", true, { grupo: "Relatórios", sub: true, secao: G }),
        M("/relatorios/compras", "Compras", "🛒", v("financeiro"), { grupo: "Relatórios", sub: true, secao: G }),
        M("/relatorios/garantias", "Garantias", "🛡️", true, { grupo: "Relatórios", sub: true, secao: G }),
        M("/relatorios/produtos", "Produtos", "📦", v("pecas"), { grupo: "Relatórios", sub: true, secao: G }),
        M("/relatorios/os", "Ordens de Serviço", "🛠️", true, { grupo: "Relatórios", sub: true, secao: G }),
        M("/relatorios/vendas", "Vendas", "🧾", v("financeiro"), { grupo: "Relatórios", sub: true, secao: G }),
        M("/relatorios/financeiro", "Financeiro", "💰", v("financeiro"), { grupo: "Relatórios", sub: true, secao: G }),
        M("/relatorios", "Contas em atraso / visão geral", "🗒️", true, { grupo: "Relatórios", sub: true, secao: G }),
        M("/emitente", "Emitente", "🏢", papel === "admin", { grupo: "Configurações", sub: true, secao: G }),
        M("/filiais", "Filiais", "🏬", papel === "admin", { grupo: "Configurações", sub: true, secao: G }),
        M("/usuarios", "Usuários e permissões", "⚙️", papel === "admin", { grupo: "Configurações", sub: true, secao: G }),
        M("/garantias/termos", "Termos de garantia", "📜", papel === "admin", { grupo: "Configurações", sub: true, secao: G }),
        M("/checklist", "Checklist", "☑️", papel === "admin", { grupo: "Configurações", sub: true, secao: G }),
        M("/tags", "Tags", "🏷️", papel === "admin", { grupo: "Configurações", sub: true, secao: G }),
        M("/anexos", "Anexos", "📎", papel === "admin", { grupo: "Configurações", sub: true, secao: G }),
        M("/parametros", "Parâmetros", "🎛️", papel === "admin", { grupo: "Configurações", sub: true, secao: G }),
        M("/painel", "Painel de gestão", "🧭", papel === "admin", { secao: G }),
      ].filter(Boolean) as ItemMenu[])
    : [];

  return (
    <html lang="pt-BR">
      <body>
        {user ? (
          <div className="shell">
            <MenuLateral logo={<Logo size={60} />} itens={itens} />
            <div className="conteudo">
              <div className="userbar">
                {empresa && <span className="muted">{empresa}</span>}
                <LogoutButton />
              </div>
              {children}
            </div>
          </div>
        ) : (
          <>
            <header className="top">
              <div className="wrap topbar">
                <Link href="/login" className="brand">
                  <Logo />
                </Link>
              </div>
            </header>
            {children}
          </>
        )}
        {user && <InstalarApp />}
      </body>
    </html>
  );
}
