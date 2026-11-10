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

  const v = (a: string) => podeVer(papel, perms, a as any);
  const M = (href: string, nome: string, icone: string, ok: boolean, extra: Partial<ItemMenu> = {}) => ok && ({ href, nome, icone, ...extra } as ItemMenu);
  const itens: ItemMenu[] = user
    ? ([
        M("/dashboard", "Início", "🏠", true),
        M("/cadastros/tarefas", "Tarefas", "✅", true),
        M("/chamados", "Chamados", "📩", v("chamados"), { badge: abertos }),
        M("/clientes", "Clientes", "👥", v("clientes")),
        M("/fornecedores", "Fornecedores", "🚚", v("financeiro")),
        M("/equipamentos", "Equipamentos", "🖨️", v("equipamentos")),
        M("/equipamentos/etiquetas", "Imprimir QR / etiquetas", "🏷️", v("equipamentos")),
        M("/ler-qr", "Ler QR", "📷", v("equipamentos")),
        M("/servicos", "Serviços", "🧰", v("os")),
        // Produtos
        M("/estoque", "Cadastrados", "📦", v("pecas"), { grupo: "Produtos", sub: true }),
        M("/cadastros/kits", "Kits", "🧩", v("pecas"), { grupo: "Produtos", sub: true }),
        M("/cadastros/movimentacao", "Movimentação", "🔁", v("pecas"), { grupo: "Produtos", sub: true }),
        M("/modulo/historico-estoque", "Histórico (Inforos)", "🕘", v("pecas"), { grupo: "Produtos", sub: true }),
        M("/cadastros/consumo-interno", "Consumo interno", "🧴", v("pecas"), { grupo: "Produtos", sub: true }),
        M("/cadastros/grupos", "Grupos", "🗂️", v("pecas"), { grupo: "Produtos", sub: true }),
        M("/cadastros/listas-de-precos", "Listas de preços", "🏷️", v("pecas"), { grupo: "Produtos", sub: true }),
        M("/compras", "Compras", "🛒", v("pecas")),
        M("/orcamentos", "Lista de orçamentos", "📝", v("os"), { grupo: "Orçamentos", sub: true }),
        M("/modulo/modelos-orcamento", "Modelos de orçamento", "📄", v("os"), { grupo: "Orçamentos", sub: true }),
        // Ordens de serviço
        M("/os", "Todas / trabalhando", "🛠️", v("os"), { grupo: "Ordens de serviço", sub: true }),
        M("/os?status=entrada", "Entrada", "📥", v("os"), { grupo: "Ordens de serviço", sub: true }),
        M("/os?status=orcamento", "Orçamento", "📝", v("os"), { grupo: "Ordens de serviço", sub: true }),
        M("/os?status=aberto", "Aberto", "🟢", v("os"), { grupo: "Ordens de serviço", sub: true }),
        M("/os?status=andamento", "Andamento", "🔧", v("os"), { grupo: "Ordens de serviço", sub: true }),
        M("/os?status=pausado", "Pausado", "⏸️", v("os"), { grupo: "Ordens de serviço", sub: true }),
        M("/os?status=concluido", "Concluído", "✔️", v("os"), { grupo: "Ordens de serviço", sub: true }),
        M("/os?status=faturado", "Faturado", "💵", v("os"), { grupo: "Ordens de serviço", sub: true }),
        M("/os?status=finalizado", "Finalizado", "🏁", v("os"), { grupo: "Ordens de serviço", sub: true }),
        M("/os?status=cancelado", "Cancelado", "🚫", v("os"), { grupo: "Ordens de serviço", sub: true }),
        M("/garantias", "Garantias", "🛡️", v("os")),
        M("/contratos", "Contratos de locação", "📄", v("contratos")),
        M("/leituras", "Leituras", "📊", v("leituras")),
        M("/vendas", "Vendas", "🧾", v("financeiro")),
        // Financeiro
        M("/financeiro", "Faturas / lançamentos", "💰", v("financeiro"), { grupo: "Financeiro", sub: true }),
        M("/cadastros/transferencias", "Transferências", "↔️", v("financeiro"), { grupo: "Financeiro", sub: true }),
        M("/extratos", "Extratos", "📃", v("financeiro"), { grupo: "Financeiro", sub: true }),
        M("/financeiro/fluxo", "Fluxo de caixa", "📈", v("financeiro"), { grupo: "Financeiro", sub: true }),
        M("/dre", "DRE", "📑", v("financeiro"), { grupo: "Financeiro", sub: true }),
        M("/metricas", "Métricas", "📊", v("financeiro"), { grupo: "Financeiro", sub: true }),
        M("/comissoes", "Comissões", "🤝", v("financeiro"), { grupo: "Financeiro", sub: true }),
        M("/notas-fiscais", "Notas fiscais", "🧮", v("financeiro"), { grupo: "Notas fiscais", sub: true }),
        M("/notas-fiscais/config", "Configurações de NF", "🧾", v("financeiro"), { grupo: "Notas fiscais", sub: true }),
        M("/notas-fiscais/tipos", "Tipos de serviço (NFS-e)", "🏷️", v("financeiro"), { grupo: "Notas fiscais", sub: true }),
        M("/relatorios", "Relatórios", "🗒️", true),
        // Configurações
        M("/usuarios", "Usuários e permissões", "⚙️", papel === "admin", { grupo: "Configurações", sub: true }),
        M("/emitente", "Emitente / filiais", "🏢", papel === "admin", { grupo: "Configurações", sub: true }),
        M("/garantias/termos", "Termos de garantia", "📜", papel === "admin", { grupo: "Configurações", sub: true }),
        M("/cadastros/checklist", "Checklist", "☑️", papel === "admin", { grupo: "Configurações", sub: true }),
        M("/cadastros/tags", "Tags", "🔖", papel === "admin", { grupo: "Configurações", sub: true }),
        M("/emitente", "Parâmetros", "🎛️", papel === "admin", { grupo: "Configurações", sub: true }),
        M("/painel", "Painel de gestão", "🧭", papel === "admin"),
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
