import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { podeVer } from "@/lib/permissoes";
import { moeda } from "@/lib/format";
import { tudo } from "@/lib/paginar";
import { STATUS_OS } from "@/lib/os";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function Metricas() {
  const { supabase, perfil } = await getContexto();
  if (!podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro")) redirect("/dashboard");
  const hoje = new Date();
  const ini = iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const iniAnt = iso(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1));
  const ini12 = iso(new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1));
  const hojeIso = iso(hoje);

  const [fin, vendas, os] = await Promise.all([
    tudo(() => supabase.from("finance_entries").select("kind, amount, due_date, paid_at").order("id")),
    tudo(() => supabase.from("sales").select("sold_at, total, client_id, clients(name)").gte("sold_at", ini12).order("id")),
    tudo(() => supabase.from("service_orders").select("status").order("id")),
  ]);
  const soma = (ls: any[], f: (l: any) => boolean) => ls.filter(f).reduce((s, l) => s + Number(l.amount), 0);
  const noMes = (d: string | null, a: string, b?: string) => !!d && d >= a && (!b || d < b);
  const recMes = soma(fin, (l) => l.kind === "receita" && noMes(l.paid_at, ini));
  const desMes = soma(fin, (l) => l.kind === "despesa" && noMes(l.paid_at, ini));
  const recAnt = soma(fin, (l) => l.kind === "receita" && noMes(l.paid_at, iniAnt, ini));
  const desAnt = soma(fin, (l) => l.kind === "despesa" && noMes(l.paid_at, iniAnt, ini));
  const aReceber = soma(fin, (l) => l.kind === "receita" && !l.paid_at);
  const atraso = soma(fin, (l) => l.kind === "receita" && !l.paid_at && l.due_date < hojeIso);
  const aPagar = soma(fin, (l) => l.kind === "despesa" && !l.paid_at);

  const porMes: Record<string, { n: number; total: number }> = {};
  const porCliente: Record<string, { nome: string; total: number }> = {};
  for (const v of vendas) {
    const k = String(v.sold_at).slice(0, 7);
    (porMes[k] ??= { n: 0, total: 0 }).n++; porMes[k].total += Number(v.total);
    const c = (porCliente[v.client_id ?? "?"] ??= { nome: v.clients?.name ?? "—", total: 0 }); c.total += Number(v.total);
  }
  const meses = Object.keys(porMes).sort().reverse();
  const top = Object.values(porCliente).sort((a, b) => b.total - a.total).slice(0, 10);
  const porStatus: Record<string, number> = {};
  for (const o of os) porStatus[o.status] = (porStatus[o.status] ?? 0) + 1;
  const card = (t: string, v: string, s?: string) => (
    <div className="card" style={{ flex: "1 1 200px" }}><div className="muted">{t}</div><div style={{ fontSize: 22, fontWeight: 800 }}>{v}</div>{s && <div className="muted">{s}</div>}</div>
  );
  return (
    <main className="wrap">
      <h1 className="title">Métricas</h1>
      <p className="muted">Resumo do financeiro, das vendas e das ordens de serviço.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        {card("Recebido no mês", moeda(recMes), `mês anterior ${moeda(recAnt)}`)}
        {card("Pago no mês", moeda(desMes), `mês anterior ${moeda(desAnt)}`)}
        {card("Resultado do mês", moeda(recMes - desMes), `mês anterior ${moeda(recAnt - desAnt)}`)}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        {card("A receber (em aberto)", moeda(aReceber))}
        {card("Em atraso", moeda(atraso))}
        {card("A pagar (em aberto)", moeda(aPagar))}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, alignItems: "flex-start" }}>
        <section className="card" style={{ flex: "1 1 320px" }}>
          <h2>Vendas por mês</h2>
          <table><thead><tr><th>Mês</th><th style={{ textAlign: "right" }}>Vendas</th><th style={{ textAlign: "right" }}>Total</th></tr></thead>
            <tbody>{meses.map((m) => <tr key={m}><td>{m.slice(5)}/{m.slice(0, 4)}</td><td style={{ textAlign: "right" }}>{porMes[m].n}</td><td style={{ textAlign: "right" }}>{moeda(porMes[m].total)}</td></tr>)}</tbody></table>
        </section>
        <section className="card" style={{ flex: "1 1 320px" }}>
          <h2>Maiores clientes (12 meses)</h2>
          <table><tbody>{top.map((c, i) => <tr key={i}><td>{c.nome}</td><td style={{ textAlign: "right" }}>{moeda(c.total)}</td></tr>)}</tbody></table>
        </section>
        <section className="card" style={{ flex: "1 1 240px" }}>
          <h2>Ordens de serviço</h2>
          <table><tbody>{Object.entries(STATUS_OS).map(([k, n]) => <tr key={k}><td>{n}</td><td style={{ textAlign: "right" }}>{porStatus[k] ?? 0}</td></tr>)}</tbody></table>
        </section>
      </div>
    </main>
  );
}
