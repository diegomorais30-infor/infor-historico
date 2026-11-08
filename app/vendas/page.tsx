import Link from "next/link";
import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { podeVer } from "@/lib/permissoes";
import { fmtData, moeda } from "@/lib/format";

export default async function Vendas({ searchParams }: { searchParams: Promise<{ mes?: string; q?: string; ver?: string }> }) {
  const { mes, q, ver } = await searchParams;
  const { supabase, perfil } = await getContexto();
  if (!podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro")) redirect("/dashboard");

  let consulta = supabase
    .from("sales")
    .select("id, number, sold_at, total, discount, billed, seller, notes, clients!inner(name)", { count: "exact" })
    .order("sold_at", { ascending: false })
    .order("number", { ascending: false })
    .limit(300);
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [a, m] = mes.split("-").map(Number);
    const prox = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
    consulta = consulta.gte("sold_at", `${mes}-01`).lt("sold_at", prox);
  }
  if (q) consulta = consulta.ilike("clients.name", `%${q.replace(/[%,]/g, " ")}%`);
  if (ver === "abertas") consulta = consulta.eq("billed", false);
  if (ver === "faturadas") consulta = consulta.eq("billed", true);
  const { data, count } = await consulta;
  const lista: any[] = data ?? [];
  const total = lista.reduce((s, v) => s + Number(v.total), 0);

  return (
    <main className="wrap">
      <h1 className="title">Vendas</h1>
      <p className="muted">Inclui as faturas mensais de locação migradas do Inforos.</p>
      <form className="card" style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <label>Mês<input type="month" name="mes" defaultValue={mes ?? ""} /></label>
        <label>Cliente<input name="q" defaultValue={q ?? ""} placeholder="Nome do cliente" /></label>
        <label>Situação
          <select name="ver" defaultValue={ver ?? ""}>
            <option value="">Todas</option><option value="abertas">Não faturadas</option><option value="faturadas">Faturadas</option>
          </select>
        </label>
        <button className="btn primary">Filtrar</button>
        <Link className="btn secondary" href="/vendas">Limpar</Link>
      </form>
      <p className="muted" style={{ marginTop: 10 }}>
        {count ?? lista.length} venda(s){(count ?? 0) > lista.length ? ` (mostrando as ${lista.length} mais recentes)` : ""} · total listado {moeda(total)}
      </p>
      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Nº</th><th>Data</th><th>Cliente</th><th>Vendedor</th><th>Observações</th><th style={{ textAlign: "right" }}>Total</th><th>Situação</th></tr></thead>
          <tbody>
            {lista.map((v) => (
              <tr key={v.id}>
                <td><Link href={`/vendas/${v.id}`}>#{v.number}</Link></td>
                <td>{fmtData(v.sold_at)}</td>
                <td>{v.clients?.name}</td>
                <td>{v.seller ?? "—"}</td>
                <td>{v.notes ?? ""}</td>
                <td style={{ textAlign: "right" }}>{moeda(Number(v.total))}</td>
                <td>{v.billed ? "Faturada" : "Em aberto"}</td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={7} className="muted">Nenhuma venda encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
