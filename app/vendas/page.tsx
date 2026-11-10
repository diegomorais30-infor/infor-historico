import Link from "next/link";
import ConfigTabela from "@/components/config-tabela";
import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { podeEditar, podeVer } from "@/lib/permissoes";
import { fmtData, moeda } from "@/lib/format";

export default async function Vendas({ searchParams }: { searchParams: Promise<{ mes?: string; q?: string; ver?: string; vend?: string }> }) {
  const { mes, q, ver, vend } = await searchParams;
  const { supabase, perfil } = await getContexto();
  if (!podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro")) redirect("/dashboard");

  let consulta = supabase
    .from("sales")
    .select("id, number, sold_at, total, discount, billed, seller, notes, clients!inner(name), sale_items(description)", { count: "exact" })
    .order("number", { ascending: false })
    .limit(300);
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [a, m] = mes.split("-").map(Number);
    const prox = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
    consulta = consulta.gte("sold_at", `${mes}-01`).lt("sold_at", prox);
  }
  const termo = (q ?? "").replace(/[%,]/g, " ").trim();
  if (termo) {
    if (/^\d+$/.test(termo)) consulta = consulta.eq("number", Number(termo));
    else consulta = consulta.ilike("clients.name", `%${termo}%`);
  }
  if (vend) consulta = consulta.ilike("seller", `%${vend.replace(/[%,]/g, " ")}%`);
  if (ver === "abertas") consulta = consulta.eq("billed", false);
  if (ver === "faturadas") consulta = consulta.eq("billed", true);
  const { data, count } = await consulta;
  const lista: any[] = data ?? [];
  const total = lista.reduce((s, v) => s + Number(v.total), 0);
  const temFiltro = !!(mes || ver || vend);

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="title">Vendas</h1>
          <div className="muted">Vendas de produtos e serviços, com o faturamento de cada uma. Inclui as faturas mensais de locação migradas do Inforos.</div>
        </div>
        {podeEditar(perfil?.role, (perfil as any)?.permissions, "financeiro") && <Link className="btn primary" href="/vendas/nova">+ Nova venda</Link>}
      </div>

      <form style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", marginBottom: 12 }}>
        {mes && <input type="hidden" name="mes" value={mes} />}
        {ver && <input type="hidden" name="ver" value={ver} />}
        {vend && <input type="hidden" name="vend" value={vend} />}
        <input name="q" defaultValue={q ?? ""} placeholder="Buscar (cliente ou nº da venda)" style={{ maxWidth: 340, flex: 1 }} />
        <button className="btn secondary">Buscar</button>
      </form>

      <details className="card" style={{ marginBottom: 14 }} open={temFiltro}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Filtros{temFiltro ? " (ativos)" : ""}</summary>
        <form className="grid g4" style={{ marginTop: 10 }}>
          {q && <input type="hidden" name="q" value={q} />}
          <label className="field">Mês<input type="month" name="mes" defaultValue={mes ?? ""} /></label>
          <label className="field">Vendedor<input name="vend" defaultValue={vend ?? ""} /></label>
          <label className="field">Situação
            <select name="ver" defaultValue={ver ?? ""}>
              <option value="">Todas</option><option value="abertas">Não faturadas</option><option value="faturadas">Faturadas</option>
            </select>
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
            <button className="btn primary">Aplicar</button>
            <Link className="btn secondary" href="/vendas">Limpar</Link>
          </div>
        </form>
      </details>

      <section className="card">
        <div className="headrow" style={{ marginBottom: 8, alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Vendas</h2>
          <span className="muted">
            <b>{count ?? lista.length}</b> vendas{(count ?? 0) > lista.length ? ` (mostrando as ${lista.length} mais recentes)` : ""} · total listado <b>{moeda(total)}</b>
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <ConfigTabela chave="vendas" />
          <table>
            <thead>
              <tr>
                <th>#</th><th>Data</th><th>Produto</th><th>Cliente</th><th>Vendedor</th><th>Observações</th><th>Status</th><th style={{ textAlign: "right" }}>Valor</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((v) => {
                const itens: any[] = v.sale_items ?? [];
                const produto = itens[0]?.description ? String(itens[0].description).split(" — ")[0] : "";
                return (
                  <tr key={v.id}>
                    <td><Link href={`/vendas/${v.id}`} style={{ color: "var(--link)", fontWeight: 700 }}>{v.number}</Link></td>
                    <td>{fmtData(v.sold_at)}</td>
                    <td>{produto}{itens.length > 1 ? <span className="muted"> +{itens.length - 1}</span> : ""}</td>
                    <td><b>{v.clients?.name}</b></td>
                    <td>{v.seller ?? "—"}</td>
                    <td>{v.notes ?? ""}</td>
                    <td><span className={v.billed ? "badge" : "badge warn"}>{v.billed ? "Faturado" : "Em aberto"}</span></td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{moeda(Number(v.total))}</td>
                    <td><Link className="btn secondary" href={`/vendas/${v.id}`} title="Ver venda">👁</Link></td>
                  </tr>
                );
              })}
              {!lista.length && <tr><td colSpan={9} className="muted">Nenhuma venda encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
