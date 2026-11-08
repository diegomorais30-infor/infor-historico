import Link from "next/link";
import { getContexto } from "@/lib/contexto";
import { podeVer } from "@/lib/permissoes";
import { fmtData, moeda } from "@/lib/format";
import { tudo } from "@/lib/paginar";

export default async function Relatorios() {
  const { supabase, perfil } = await getContexto();
  const verFin = podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro");
  const hoje = new Date().toISOString().slice(0, 10);
  const atrasados = verFin
    ? await tudo(() => supabase.from("finance_entries").select("id, description, party, amount, due_date, clients(name)").eq("kind", "receita").is("paid_at", null).lt("due_date", hoje).order("due_date"))
    : [];
  const link = (href: string, t: string, d: string) => (<Link key={href} href={href} className="card" style={{ flex: "1 1 220px", display: "block" }}><b>{t}</b><div className="muted">{d}</div></Link>);
  return (
    <main className="wrap">
      <h1 className="title">Relatórios</h1>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        {link("/os", "Ordens de serviço", "Lista com filtros por status e prazo")}
        {link("/leituras", "Leituras de contadores", "Por cliente e por contrato")}
        {verFin && link("/dre", "DRE", "Resultado por categoria")}
        {verFin && link("/extratos", "Extratos", "Movimentação paga e saldo")}
        {verFin && link("/vendas", "Vendas", "Faturas de locação e vendas avulsas")}
        {verFin && link("/metricas", "Métricas", "Indicadores do mês")}
        {verFin && link("/comissoes", "Comissões", "Vendas por vendedor")}
      </div>
      {verFin && (
        <section className="card" style={{ marginTop: 16, overflowX: "auto" }}>
          <h2>Contas a receber em atraso</h2>
          <p className="muted">{atrasados.length} lançamento(s) · total {moeda(atrasados.reduce((s: number, l: any) => s + Number(l.amount), 0))}</p>
          <table>
            <thead><tr><th>Vencimento</th><th>Cliente</th><th>Descrição</th><th style={{ textAlign: "right" }}>Valor</th></tr></thead>
            <tbody>
              {atrasados.map((l: any) => (<tr key={l.id}><td>{fmtData(l.due_date)}</td><td>{l.clients?.name ?? l.party ?? "—"}</td><td>{l.description}</td><td style={{ textAlign: "right" }}>{moeda(Number(l.amount))}</td></tr>))}
              {!atrasados.length && <tr><td colSpan={4} className="muted">Nenhum lançamento em atraso.</td></tr>}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
