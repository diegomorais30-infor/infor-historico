import Link from "next/link";
import { notFound } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import BotaoImprimir from "@/components/botao-imprimir";
import { podeVer } from "@/lib/permissoes";
import { lerFiltros, RELATORIOS, semValores, SO_FINANCEIRO } from "@/lib/relatorios";

export default async function RelatorioPagina({ params, searchParams }: { params: Promise<{ tipo: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tipo } = await params;
  const cfg = RELATORIOS[tipo];
  if (!cfg) notFound();
  const sp = await searchParams;
  const f = lerFiltros(sp);
  const { supabase, perfil } = await getContexto();
  const verFin = podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro");
  if (!verFin && SO_FINANCEIRO.includes(tipo)) notFound();
  const bruto = await cfg.carregar(supabase, f);
  const r = verFin ? bruto : semValores(bruto);
  const qs = new URLSearchParams({ de: f.de, ate: f.ate, q: f.q, status: f.status }).toString();

  return (
    <main className="wrap">
      <h1 className="title">Relatório de {cfg.titulo}</h1>
      <nav className="os-sub" style={{ margin: "10px 0", flexWrap: "wrap" }}>
        {Object.entries(RELATORIOS).filter(([k]) => verFin || !SO_FINANCEIRO.includes(k)).map(([k, v]) => (
          <Link key={k} href={`/relatorios/${k}`} className={k === tipo ? "ativa" : ""}>{v.titulo}</Link>
        ))}
      </nav>
      <form className="card" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginBottom: 12 }}>
        <label className="field">{cfg.dataRotulo} de<input type="date" name="de" defaultValue={f.de} /></label>
        <label className="field">até<input type="date" name="ate" defaultValue={f.ate} /></label>
        <label className="field" style={{ flex: 1, minWidth: 200 }}>Buscar<input name="q" defaultValue={f.q} placeholder="Nome, número, documento…" /></label>
        {cfg.statusOpcoes && (
          <label className="field">Situação
            <select name="status" defaultValue={f.status}>
              <option value="">Todas</option>
              {cfg.statusOpcoes.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </label>
        )}
        <Link className="btn secondary" href={`/relatorios/${tipo}`}>Limpar</Link>
        <button className="btn primary">Aplicar</button>
      </form>

      <section className="card">
        <div className="headrow" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Resultado</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <a className="btn primary" href={`/relatorios/${tipo}/csv?${qs}`}>Excel (CSV)</a>
            <BotaoImprimir />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          {r.cards.map((c) => (
            <div key={c.t} className="os-bloco" style={{ flex: "1 1 150px", borderLeft: `4px solid ${c.cor ?? "#64748b"}` }}>
              <div className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>{c.t}</div>
              <b style={{ fontSize: 22 }}>{c.v}</b>
            </div>
          ))}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead><tr>{r.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {r.rows.slice(0, 1000).map((l, i) => <tr key={i}>{l.map((v, j) => <td key={j}>{v}</td>)}</tr>)}
              {!r.rows.length && <tr><td colSpan={r.cols.length} className="muted" style={{ textAlign: "center" }}>Nada encontrado nesse período.</td></tr>}
            </tbody>
          </table>
        </div>
        {r.rows.length > 1000 && <p className="muted">Mostrando 1.000 de {r.rows.length}. Baixe o Excel para ver tudo.</p>}
      </section>
    </main>
  );
}
