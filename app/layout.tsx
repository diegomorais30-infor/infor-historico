import "./globals.css";
import { Logo } from "@/components/logo";
import { NOME_PRODUTO } from "@/lib/marca";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";
import InstalarApp from "@/components/instalar-app";
import { podeVer } from "@/lib/permissoes";

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

  return (
    <html lang="pt-BR">
      <body>
        <header className="top">
          <div className="wrap topbar">
            <Link href={user ? "/dashboard" : "/login"} className="brand">
              <Logo />
            </Link>
            {user && (
              <nav className="topnav">
                <Link href="/dashboard">Início</Link>
                {podeVer(papel, perms, "chamados") && <Link href="/chamados">Chamados{abertos > 0 ? ` (${abertos})` : ""}</Link>}
                {podeVer(papel, perms, "os") && <Link href="/os">OS</Link>}
                {podeVer(papel, perms, "equipamentos") && <Link href="/equipamentos">Equipamentos</Link>}
                {podeVer(papel, perms, "equipamentos") && <Link href="/ler-qr">Ler QR</Link>}
                {podeVer(papel, perms, "clientes") && <Link href="/clientes">Clientes</Link>}
                {podeVer(papel, perms, "contratos") && <Link href="/contratos">Contratos</Link>}
                {podeVer(papel, perms, "leituras") && <Link href="/leituras">Leituras</Link>}
                {podeVer(papel, perms, "pecas") && <Link href="/estoque">Estoque</Link>}
                {papel === "admin" && <Link href="/usuarios">Usuários</Link>}
              </nav>
            )}
            <div className="topuser">
              {empresa && <span className="muted">{empresa}</span>}
              {user && <LogoutButton />}
            </div>
          </div>
        </header>
        {children}
        {user && <InstalarApp />}
      </body>
    </html>
  );
}
