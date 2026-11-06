import "./globals.css";
import { Logo } from "@/components/logo";
import { NOME_PRODUTO } from "@/lib/marca";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";
import InstalarApp from "@/components/instalar-app";

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
  let abertos = 0;
  if (user) {
    const { count } = await supabase
      .from("service_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "open");
    abertos = count ?? 0;
    const { data } = await supabase
      .from("profiles")
      .select("role, companies(name)")
      .eq("id", user.id)
      .single();
    empresa = (data as any)?.companies?.name ?? "";
    papel = (data as any)?.role ?? "";
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
                <Link href="/chamados">Chamados{abertos > 0 ? ` (${abertos})` : ""}</Link>
                <Link href="/equipamentos">Equipamentos</Link>
                <Link href="/ler-qr">Ler QR</Link>
                <Link href="/clientes">Clientes</Link>
                <Link href="/contratos">Contratos</Link>
                <Link href="/leituras">Leituras</Link>
                <Link href="/pecas">Peças</Link>
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
