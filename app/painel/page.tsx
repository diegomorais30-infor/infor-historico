import Link from "next/link";
import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { podeVer } from "@/lib/permissoes";
import { moeda, hojeBR } from "@/lib/format";
import { tudo } from "@/lib/paginar";
import { STATUS_OS } from "@/lib/os";
import { Barras, BarrasH, Indicador, Linhas, Medidor, Rosca } from "@/components/graficos";

const somaMes = (m: string, n: number) => {
  const d = new Date(`${m}-15T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};
const rot = (m: string) => `${m.slice(5)}/${m.slice(2, 4)}`;
const rotLongo = (m: string) =>
  ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][Number(m.slice(5)) - 1] + " de " + m.slice(0, 4);
const mesDe = (ts: string | null) => (ts ? new Date(ts).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7) : "");
const topo = (mapa: Record<string, number>, n = 8) =>
  Object.entries(mapa).sort((a, b) => b[1] - a[1]).slice(0, n).map(([nome, valor]) => ({ nome, valor }));

export default async function Painel({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const { supabase, perfil } = await getContexto();
  if (!podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro")) redirect("/dashboard");
  const hoje = hojeBR();
  const mesHoje = hoje.slice(0, 7);
  const M = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : mesHoje;
  const meses = Array.from({ length: 12 }, (_, i) => somaMes(M, i - 11));

  const [fin, abertos, vendas, os, pessoas] = await Promise.all([
    tudo(() => supabase.from("finance_entries").select("kind,amount,paid_at,category,payment_method").gte("paid_at", `${meses[0]}-01`).order("id")),
    tudo(() => supabase.from("finance_entries").select("kind,amount,due_date").is("paid_at", null).order("id")),
    tudo(() => supabase.from("sales").select("sold_at,total,client_id,clients(name)").gte("sold_at", `${meses[0]}-01`).order("id")),
    tudo(() => supabase.from("service_orders").select("id,status,entry_at,closed_at,technician_id,clients(name)").order("id")),
    supabase.from("profiles").select("id,full_name"),
  ]);
  const nomePessoa = (id: string | null) => ((pessoas.data as any[]) ?? []).find((p) => p.id === id)?.full_name ?? "Sem técnico";

  const soma = (l: any[]) => l.reduce((t, x) => t + Number(x.amount ?? x.total ?? 0), 0);
  const pagoNoMes = (k: string, m: string) => fin.filter((l: any) => l.kind === k && mesDe(l.paid_at) === m);
  const rec = soma(pagoNoMes("receita", M));
  const des = soma(pagoNoMes("despesa", M));
  const recAnt = soma(pagoNoMes("receita", somaMes(M, -1)));
  const desAnt = soma(pagoNoMes("despesa", somaMes(M, -1)));
  const venceNoMes = (k: string) => abertos.filter((l: any) => l.kind === k && String(l.due_date).slice(0, 7) === M);
  const aReceber = soma(venceNoMes("receita"));
  const aPagar = soma(venceNoMes("despesa"));
  const atraso = soma(abertos.filter((l: any) => l.kind === "receita" && l.due_date < hoje));
  const totalAberto = soma(abertos.filter((l: any) => l.kind === "receita"));

  const vendasMes = vendas.filter((v: any) => mesDe(v.sold_at) === M);
  const totalVendas = soma(vendasMes);

  const osAbertas = (m: string) => os.filter((o: any) => mesDe(o.entry_at) === m).length;
  const osFechadas = (m: string) => os.filter((o: any) => mesDe(o.closed_at) === m).length;
  const osMesFechadas = os.filter((o: any) => mesDe(o.closed_at) === M && o.status !== "cancelado");

  // Faturado em OS: itens (qtd x preço) das OS fechadas no mês
  let faturadoOS = 0;
  const ids = osMesFechadas.map((o: any) => o.id);
  const porTecnico: Record<string, number> = {};
  for (const o of osMesFechadas) { const n = nomePessoa(o.technician_id); porTecnico[n] = (porTecnico[n] ?? 0) + 1; }
  for (let i = 0; i < ids.length; i += 150) {
    const { data: itens } = await supabase.from("service_order_items").select("id,quantity").in("order_id", ids.slice(i, i + 150));
    const lista = (itens as any[]) ?? [];
    for (let j = 0; j < lista.length; j += 150) {
      const parte = lista.slice(j, j + 150);
      const { data: precos } = await supabase.from("item_prices").select("item_id,unit_price").in("item_id", parte.map((x) => x.id));
      const mapa = new Map(((precos as any[]) ?? []).map((p) => [p.item_id, Number(p.unit_price)]));
      for (const it of parte) faturadoOS += Number(it.quantity) * (mapa.get(it.id) ?? 0);
    }
  }
  const ticket = osMesFechadas.length ? faturadoOS / osMesFechadas.length : 0;

  const agrupa = (l: any[], campo: string, vazio: string) => {
    const r: Record<string, number> = {};
    for (const x of l) { const k = (x[campo] || vazio) as string; r[k] = (r[k] ?? 0) + Number(x.amount); }
    return r;
  };
  const recCat = agrupa(pagoNoMes("receita", M), "category", "Sem categoria");
  const desCat = agrupa(pagoNoMes("despesa", M), "category", "Sem categoria");
  const forma = agrupa(pagoNoMes("receita", M), "payment_method", "Não informada");
  const porCliente: Record<string, number> = {};
  for (const v of vendasMes) { const n = (v as any).clients?.name ?? "Consumidor"; porCliente[n] = (porCliente[n] ?? 0) + Number((v as any).total); }
  const statusN: Record<string, number> = {};
  for (const o of os) statusN[o.status] = (statusN[o.status] ?? 0) + 1;

  const resultado = rec - des;
  const variacao = (a: number, b: number) => (b ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}% vs mês anterior` : "sem mês anterior");

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 14 }}>
        <div>
          <h1 className="title">Painel de gestão</h1>
          <p className="muted">{rotLongo(M).replace(/^./, (c) => c.toUpperCase())}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Link className="btn secondary" href={`/painel?mes=${somaMes(M, -1)}`}>← {rot(somaMes(M, -1))}</Link>
          {M !== mesHoje && <Link className="btn secondary" href="/painel">Mês atual</Link>}
          {M < mesHoje && <Link className="btn secondary" href={`/painel?mes=${somaMes(M, 1)}`}>{rot(somaMes(M, 1))} →</Link>}
          <Link className="btn secondary" href="/metricas">Métricas detalhadas</Link>
        </div>
      </div>

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Indicador titulo="Receitas pagas" valor={moeda(rec)} sub={variacao(rec, recAnt)} cor="#3ccf91" />
        <Indicador titulo="Despesas pagas" valor={moeda(des)} sub={variacao(des, desAnt)} cor="#ff7a7a" />
        <Indicador titulo="Resultado do mês" valor={moeda(resultado)} sub={resultado >= 0 ? "positivo" : "negativo"} cor={resultado >= 0 ? "#3ccf91" : "#ff7a7a"} />
        <Indicador titulo="Vendas" valor={moeda(totalVendas)} sub={`${vendasMes.length} venda(s)`} cor="#ff9f43" href="/vendas" />
        <Indicador titulo="A receber (vence no mês)" valor={moeda(aReceber)} cor="#4ea1ff" href="/financeiro" />
        <Indicador titulo="A pagar (vence no mês)" valor={moeda(aPagar)} cor="#f6c500" href="/financeiro" />
        <Indicador titulo="Faturado em OS" valor={moeda(faturadoOS)} sub={`${osMesFechadas.length} OS fechada(s)`} cor="#b48cff" href="/os" />
        <Indicador titulo="Ticket médio por OS" valor={moeda(ticket)} cor="#5fd0e0" />
      </div>

      <div className="grid g2" style={{ marginBottom: 14 }}>
        <section className="card">
          <h3 style={{ margin: "0 0 8px" }}>Receitas x despesas (12 meses)</h3>
          <Barras dinheiro categorias={meses.map(rot)} series={[
            { nome: "Receitas", cor: "#3ccf91", valores: meses.map((m) => soma(pagoNoMes("receita", m))) },
            { nome: "Despesas", cor: "#ff7a7a", valores: meses.map((m) => soma(pagoNoMes("despesa", m))) },
          ]} />
        </section>
        <section className="card">
          <h3 style={{ margin: "0 0 8px" }}>Vendas por mês (12 meses)</h3>
          <Linhas dinheiro categorias={meses.map(rot)} series={[
            { nome: "Vendas", cor: "#ff9f43", valores: meses.map((m) => soma(vendas.filter((v: any) => mesDe(v.sold_at) === m))) },
          ]} />
        </section>
      </div>

      <div className="grid g2" style={{ marginBottom: 14 }}>
        <section className="card">
          <h3 style={{ margin: "0 0 8px" }}>OS abertas x fechadas (12 meses)</h3>
          <Barras categorias={meses.map(rot)} series={[
            { nome: "Abertas", cor: "#4ea1ff", valores: meses.map(osAbertas) },
            { nome: "Fechadas", cor: "#3ccf91", valores: meses.map(osFechadas) },
          ]} />
        </section>
        <section className="card">
          <h3 style={{ margin: "0 0 8px" }}>Ordens de serviço por status</h3>
          <Rosca itens={Object.entries(STATUS_OS).map(([k, n]) => ({ nome: n, valor: statusN[k] ?? 0 }))} />
        </section>
      </div>

      <div className="grid g3" style={{ marginBottom: 14 }}>
        <section className="card">
          <h3 style={{ margin: "0 0 8px" }}>Receitas por categoria</h3>
          <Rosca dinheiro itens={topo(recCat, 7)} centro={moeda(rec)} />
        </section>
        <section className="card">
          <h3 style={{ margin: "0 0 8px" }}>Despesas por categoria</h3>
          <Rosca dinheiro itens={topo(desCat, 7)} centro={moeda(des)} />
        </section>
        <section className="card">
          <h3 style={{ margin: "0 0 8px" }}>Receitas por forma de pagamento</h3>
          <Rosca dinheiro itens={topo(forma, 7)} centro={moeda(rec)} />
        </section>
      </div>

      <div className="grid g3">
        <section className="card">
          <h3 style={{ margin: "0 0 8px" }}>Maiores clientes (vendas do mês)</h3>
          <BarrasH dinheiro itens={topo(porCliente, 8)} />
        </section>
        <section className="card">
          <h3 style={{ margin: "0 0 8px" }}>OS fechadas por técnico</h3>
          <BarrasH itens={topo(porTecnico, 8)} cor="#b48cff" />
        </section>
        <section className="card">
          <h3 style={{ margin: "0 0 8px" }}>Inadimplência</h3>
          <Medidor pct={totalAberto ? (atraso / totalAberto) * 100 : 0} rotulo="em atraso do a receber" cor="#ff7a7a" />
          <div className="muted" style={{ textAlign: "center", marginTop: 6 }}>{moeda(atraso)} de {moeda(totalAberto)}</div>
        </section>
      </div>
    </main>
  );
}
