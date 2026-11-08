"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type ItemMenu = { href: string; nome: string; icone: string; badge?: number };

export default function MenuLateral({ itens, logo }: { itens: ItemMenu[]; logo: React.ReactNode }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  return (
    <aside className={`side${aberto ? " aberto" : ""}`}>
      <div className="side-head">
        <Link href="/dashboard" className="brand">
          {logo}
        </Link>
        <button type="button" className="side-toggle" onClick={() => setAberto((v) => !v)} aria-label="Menu">
          ☰
        </button>
      </div>
      <nav className="side-nav" onClick={() => setAberto(false)}>
        {itens.map((i) => {
          const ativo = pathname === i.href || pathname.startsWith(i.href + "/");
          return (
            <Link key={i.href} href={i.href} className={ativo ? "ativo" : ""}>
              <span className="ico" aria-hidden>
                {i.icone}
              </span>
              <span>{i.nome}</span>
              {!!i.badge && <span className="pill">{i.badge}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
