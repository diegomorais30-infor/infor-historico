import Link from "next/link";
import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { podeVer } from "@/lib/permissoes";
import { moeda } from "@/lib/format";
import { tudo } from "@/lib/paginar";

export default async function Comissoes({ searchParams }: { searchParams: Promise<{ mes?: string; pct?: string }> }) {
  const { mes: mp, pct } = await searchParams;
  const { supabase, perfil } = await getContexto();
  if (!podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro")) redirect("/dashboard");
  const h = new Date();
  const mes = /^\d{4}-\d{2}$/.test(mp ?? "") ? mp! : `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
  const [a, m] = mes.split("-").map(Number);
  const prox = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
  const taxa = Math.max(Number(String(pct ?? "0").replace(",", ".")) || 0, 0);
  const vendas = await tudo(() => supabase.from("sales").select("seller, total, billed").gte("sold_at", `${mes}-01`).lt("sold_at", prox).order("id"));
  const por: Record<string, { n: number; total: number; fat: number }> = {};
  for (const v of vendas) {
    const k = v.seller ?? "Sem vendedor";
    const x = (por[k] ??= { n: 0, total: 0, fat: 0 });
    x.n++; x.total += Number(v.total); if (v.billed) x.fat += Number(v.total);
  }
  const lista = Object.entries(por).sort((x, y) => y[1].total - x[1].total);
  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <h1 className="title">Comissões</h1>
      <p className="muted">Vendas por vendedor no mês. A comissão é calculada sobre o valor faturado, com o percentual que você informar.</p>
      <form className="card" style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
        <label>Mês<input type="month" name="mes" defaultValue={mes} /></label>
        <label>Comissão (%)<input name="pct" defaultValue={pct ?? ""} style={{ width: 90 }} placeholder="ex.: 5" /></label>
        <button className="btn primary">Calcular</button>
        <Link className="btn secondary" href="/comissoes">Limpar</Link>
      </form>
      <div className="card" style={{ marginTop: 12, overflowX: "auto" }}>
        <table>
          <thead><tr><th>Vendedor</th><th style={{ textAlign: "right" }}>Vendas</th><th style={{ textAlign: "right" }}>Total vendido</th><th style={{ textAlign: "right" }}>Faturado</th><th style={{ textAlign: "right" }}>Comissão</th></tr></thead>
          <tbody>
            {lista.map(([nome, x]) => (
              <tr key={nome}><td>{nome}</td><td style={{ textAlign: "right" }}>{x.n}</td><td style={{ textAlign: "right" }}>{moeda(x.total)}</td><td style={{ textAlign: "right" }}>{moeda(x.fat)}</td><td style={{ textAlign: "right" }}>{taxa ? moeda((x.fat * taxa) / 100) : "—"}</td></tr>
            ))}
            {!lista.length && <tr><td colSpan={5} className="muted">Sem vendas neste mês.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
