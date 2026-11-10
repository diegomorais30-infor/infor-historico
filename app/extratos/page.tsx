import Link from "next/link";
import ConfigTabela from "@/components/config-tabela";
import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { podeVer } from "@/lib/permissoes";
import { fmtData, moeda } from "@/lib/format";

export default async function Extratos({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: mesParam } = await searchParams;
  const { supabase, perfil } = await getContexto();
  if (!podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro")) redirect("/dashboard");
  const hoje = new Date();
  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const [a, m] = mes.split("-").map(Number);
  const ini = `${mes}-01`;
  const prox = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;

  const { data } = await supabase.from("finance_entries").select("id, kind, description, party, category, amount, paid_at, payment_method")
    .gte("paid_at", ini).lt("paid_at", prox).order("paid_at").order("created_at").limit(1000);
  // saldo anterior = tudo que foi pago antes do mês
  let saldoAnt = 0;
  for (let de = 0; ; de += 1000) {
    const { data: ant } = await supabase.from("finance_entries").select("kind, amount").lt("paid_at", ini).order("id").range(de, de + 999);
    for (const l of ant ?? []) saldoAnt += (l as any).kind === "receita" ? Number((l as any).amount) : -Number((l as any).amount);
    if ((ant ?? []).length < 1000) break;
  }
  let saldo = saldoAnt, ent = 0, sai = 0;
  const linhas = (data ?? []).map((l: any) => {
    const v = l.kind === "receita" ? Number(l.amount) : -Number(l.amount);
    if (v >= 0) ent += v; else sai -= v;
    saldo += v;
    return { ...l, v, saldo };
  });
  const mesAnt = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
  const mesPro = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
  return (
    <main className="wrap">
      <h1 className="title">Extratos</h1>
      <p className="muted">Movimentação paga no mês, com saldo acumulado.</p>
      <div className="card" style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
        <Link className="btn secondary" href={`/extratos?mes=${mesAnt}`}>← Anterior</Link>
        <form style={{ display: "flex", gap: 8, alignItems: "end" }}>
          <label>Mês<input type="month" name="mes" defaultValue={mes} /></label>
          <button className="btn primary">Ver</button>
        </form>
        <Link className="btn secondary" href={`/extratos?mes=${mesPro}`}>Próximo →</Link>
      </div>
      <p style={{ marginTop: 10 }}>Saldo anterior {moeda(saldoAnt)} · Entradas {moeda(ent)} · Saídas {moeda(sai)} · <b>Saldo final {moeda(saldo)}</b></p>
      <div className="card" style={{ overflowX: "auto" }}>
        <ConfigTabela chave="extratos" />
<table>
          <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Forma</th><th style={{ textAlign: "right" }}>Valor</th><th style={{ textAlign: "right" }}>Saldo</th></tr></thead>
          <tbody>
            {linhas.map((l: any) => (
              <tr key={l.id}>
                <td>{fmtData(l.paid_at)}</td><td>{l.description}{l.party ? <div className="muted">{l.party}</div> : null}</td><td>{l.category ?? "—"}</td><td>{l.payment_method ?? "—"}</td>
                <td style={{ textAlign: "right", color: l.v < 0 ? "#c0392b" : undefined }}>{moeda(l.v)}</td><td style={{ textAlign: "right" }}>{moeda(l.saldo)}</td>
              </tr>
            ))}
            {!linhas.length && <tr><td colSpan={6} className="muted">Sem movimentação paga neste mês.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
