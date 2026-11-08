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

  const itens: ItemMenu[] = user
    ? ([
        { href: "/dashboard", nome: "Início", icone: "🏠" },
        podeVer(papel, perms, "chamados") && { href: "/chamados", nome: "Chamados", icone: "📩", badge: abertos },
        podeVer(papel, perms, "os") && { href: "/os", nome: "Ordens de serviço", icone: "🛠️" },
        podeVer(papel, perms, "os") && { href: "/servicos", nome: "Serviços", icone: "🧰" },
        podeVer(papel, perms, "clientes") && { href: "/clientes", nome: "Clientes", icone: "👥" },
        podeVer(papel, perms, "equipamentos") && { href: "/equipamentos", nome: "Equipamentos", icone: "🖨️" },
        podeVer(papel, perms, "equipamentos") && { href: "/ler-qr", nome: "Ler QR", icone: "📷" },
        podeVer(papel, perms, "contratos") && { href: "/contratos", nome: "Contratos", icone: "📄" },
        podeVer(papel, perms, "leituras") && { href: "/leituras", nome: "Leituras", icone: "📊" },
        podeVer(papel, perms, "pecas") && { href: "/estoque", nome: "Estoque", icone: "📦" },
        podeVer(papel, perms, "financeiro") && { href: "/financeiro", nome: "Financeiro", icone: "💰" },
        papel === "admin" && { href: "/usuarios", nome: "Usuários", icone: "⚙️" },
      ].filter(Boolean) as ItemMenu[])
    : [];

  return (
    <html lang="pt-BR">
      <body>
        {user ? (
          <div className="shell">
            <MenuLateral logo={<Logo />} itens={itens} />
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
