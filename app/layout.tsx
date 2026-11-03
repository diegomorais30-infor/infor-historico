import "./globals.css";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";

export const metadata = {
  title: "Infor Histórico",
  description: "Gestão de equipamentos e manutenções",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let empresa = "";
  let papel = "";
  if (user) {
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
              <span className="circles">
                <i className="c" />
                <i className="c" />
                <i className="c" />
              </span>
              <span>Infor Histórico</span>
            </Link>
            {user && (
              <nav className="topnav">
                <Link href="/dashboard">Início</Link>
                <Link href="/equipamentos">Equipamentos</Link>
                <Link href="/clientes">Clientes</Link>
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
      </body>
    </html>
  );
}
