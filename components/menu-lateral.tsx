"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export type ItemMenu = { href: string; nome: string; icone: string; badge?: number; grupo?: string; sub?: boolean; secao?: string; contagem?: number };

const GRUPO_ICONE: Record<string, string> = {
  Produtos: "📦",
  Orçamentos: "📝",
  "Ordens de serviço": "🛠️",
  Financeiro: "💰",
  Configurações: "⚙️",
  "Notas fiscais": "🧮",
};

export default function MenuLateral({ itens, logo }: { itens: ItemMenu[]; logo: React.ReactNode }) {
  const pathname = usePathname();
  const busca = useSearchParams();
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState("");

  // chaves de query usadas por itens do mesmo caminho (ex.: /os?status=...), para marcar só o item certo
  const chavesPorCaminho = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const i of itens) {
      const [p, qs] = i.href.split("?");
      if (!qs) continue;
      const s = m.get(p) ?? new Set<string>();
      new URLSearchParams(qs).forEach((_, k) => s.add(k));
      m.set(p, s);
    }
    return m;
  }, [itens]);

  const ativoItem = (i: ItemMenu) => {
    const [p, qs] = i.href.split("?");
    if (!(pathname === p || pathname.startsWith(p + "/"))) return false;
    // se outro item tem um caminho mais específico que também bate, ele é o ativo
    if (itens.some((o) => { const op = o.href.split("?")[0]; return op.length > p.length && (pathname === op || pathname.startsWith(op + "/")); })) return false;
    if (qs) {
      for (const [k, v] of new URLSearchParams(qs)) if (busca.get(k) !== v) return false;
      return true;
    }
    const chaves = chavesPorCaminho.get(p);
    if (chaves) for (const k of chaves) if (busca.get(k)) return false;
    return true;
  };

  const grupoAtivo = itens.find((i) => i.grupo && ativoItem(i))?.grupo ?? null;
  const [grupoAberto, setGrupoAberto] = useState<string | null>(grupoAtivo);
  // ao navegar, abre o grupo da página atual (como no Inforos); cliques manuais valem até a próxima navegação
  useEffect(() => {
    setGrupoAberto(grupoAtivo);
  }, [pathname, busca, grupoAtivo]);

  const termo = q.trim().toLowerCase();
  const achados = termo ? itens.filter((i) => (i.nome + " " + (i.grupo ?? "")).toLowerCase().includes(termo)) : [];

  const totalDoGrupo = (g: string) => itens.filter((i) => i.grupo === g).reduce((t, i) => t + (i.badge ?? 0), 0);

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
      <div className="side-busca">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 Achar no menu" aria-label="Achar no menu" />
      </div>
      <nav className="side-nav">
        {termo && (
          <>
            {achados.length === 0 && <span className="muted" style={{ padding: "8px 12px", fontSize: 12 }}>Nada encontrado</span>}
            {achados.map((i, idx) => (
              <Link key={i.href + idx} href={i.href} onClick={() => { setAberto(false); setQ(""); }} className={ativoItem(i) ? "ativo" : ""}>
                <span className="ico" aria-hidden>{i.icone}</span>
                <span>{i.nome}{i.grupo ? <small className="muted"> · {i.grupo}</small> : null}</span>
              </Link>
            ))}
          </>
        )}
        {!termo && itens.map((i, idx) => {
          const cabecalho =
            i.grupo && itens[idx - 1]?.grupo !== i.grupo ? (
              <button
                type="button"
                className={"side-grp" + (grupoAberto === i.grupo ? " aberto" : "") + (grupoAtivo === i.grupo ? " tem-ativo" : "")}
                onClick={() => setGrupoAberto((g) => (g === i.grupo ? null : i.grupo!))}
                aria-expanded={grupoAberto === i.grupo}
              >
                <span className="ico" aria-hidden>{GRUPO_ICONE[i.grupo] ?? "📁"}</span>
                <span>{i.grupo}</span>
                {!!totalDoGrupo(i.grupo) && <span className="pill">{totalDoGrupo(i.grupo)}</span>}
                <span className="chev" aria-hidden>▾</span>
              </button>
            ) : null;
          const secao = i.secao && itens[idx - 1]?.secao !== i.secao ? <div className="side-secao">{i.secao}</div> : null;
          const oculto = !!i.grupo && grupoAberto !== i.grupo;
          const ativo = ativoItem(i);
          return (
            <span key={i.href + idx} style={{ display: "contents" }}>
              {secao}
              {cabecalho}
              {!oculto && (
                <Link href={i.href} onClick={() => setAberto(false)} className={(ativo ? "ativo" : "") + (i.sub ? " sub" : "")}>
                  <span className="ico" aria-hidden>
                    {i.icone}
                  </span>
                  <span>{i.nome}</span>
                  {!!i.badge && <span className="pill">{i.badge}</span>}
                  {i.contagem != null && <span className="pill-n">{i.contagem.toLocaleString("pt-BR")}</span>}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    </aside>
  );
}
