import Link from "next/link";
import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { podeVer } from "@/lib/permissoes";
import { moeda, hojeBR } from "@/lib/format";
import { tudo } from "@/lib/paginar";
import { STATUS_OS } from "@/lib/os";
import { Barras, BarrasH, Indicador, Linhas, Medidor, Rosca } from "@/components/graficos";
import Controles from "./controles";

// ---------- datas (sempre "AAAA-MM-DD", calculadas em UTC para não depender do fuso do servidor) ----------
const D = (s: string) => new Date(`${s}T12:00:00Z`);
const S = (d: Date) => d.toISOString().slice(0, 10);
const addDias = (s: string, n: number) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return S(d); };
const somaMes = (m: string, n: number) => { const d = new Date(`${m}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
const fimDoMes = (m: string) => addDias(`${somaMes(m, 1)}-01`, -1);
const difDias = (a: string, b: string) => Math.round((D(b).getTime() - D(a).getTime()) / 86400000);
const segunda = (s: string) => addDias(s, -((D(s).getUTCDay() + 6) % 7));
const rot = (m: string) => `${m.slice(5)}/${m.slice(2, 4)}`;
const br = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const brAno = (s: string) => `${br(s)}/${s.slice(0, 4)}`;
const diaSP = (ts: string | null) => (ts ? new Date(ts).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) : "");
const mesDe = (ts: string | null) => diaSP(ts).slice(0, 7);
const dataCol = (d: string | null) => (d ? String(d).slice(0, 10) : "");
const no = (d: string, a: string, b: string) => !!d && d >= a && d <= b;

const norm = (t: any) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const topo = (mapa: Record<string, number>, n = 8) =>
  Object.entries(mapa).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([nome, valor]) => ({ nome, valor }));
const soma = (l: any[]) => l.reduce((t, x) => t + Number(x.amount ?? x.total ?? 0), 0);
const somaEm = (m: Record<string, number>, k: string, v: number) => { m[k] = (m[k] ?? 0) + v; };
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const pctTxt = (v: number) => `${String(v).replace(".", ",")}%`;
const n1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

type Periodo = { p: string; ini: string; fim: string; rotulo: string; antIni: string; antFim: string; mes?: string };

function periodo(q: { p?: string; mes?: string; de?: string; ate?: string }, hoje: string): Periodo {
  const mesHoje = hoje.slice(0, 7);
  const valida = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  let p = q.p ?? "mes";
  if (q.mes && /^\d{4}-\d{2}$/.test(q.mes)) p = "mes";
  const doMes = (m: string, nome?: string): Periodo => {
    const a = somaMes(m, -1);
    return { p, mes: m, ini: `${m}-01`, fim: fimDoMes(m), antIni: `${a}-01`, antFim: fimDoMes(a), rotulo: nome ?? "" };
  };
  const generico = (ini: string, fim: string, rotulo: string): Periodo => {
    const n = difDias(ini, fim) + 1;
    return { p, ini, fim, rotulo, antIni: addDias(ini, -n), antFim: addDias(ini, -1) };
  };
  if (p === "mes_anterior") return doMes(somaMes(mesHoje, -1), "Mês passado");
  if (p === "semana") { const s = segunda(hoje); return generico(s, addDias(s, 6), "Esta semana"); }
  if (p === "30d") return generico(addDias(hoje, -29), hoje, "Últimos 30 dias");
  if (p === "trimestre") { const i = `${somaMes(mesHoje, -2)}-01`; return generico(i, fimDoMes(mesHoje), "Últimos 3 meses"); }
  if (p === "ano") { const a = hoje.slice(0, 4); const ant = String(Number(a) - 1); return { p, ini: `${a}-01-01`, fim: `${a}-12-31`, antIni: `${ant}-01-01`, antFim: `${ant}-12-31`, rotulo: "Este ano" }; }
  if (p === "personalizado" && valida(q.de) && valida(q.ate)) { const [i, f] = q.de! <= q.ate! ? [q.de!, q.ate!] : [q.ate!, q.de!]; return generico(i, f, "Personalizado"); }
  p = "mes";
  return doMes(q.mes && /^\d{4}-\d{2}$/.test(q.mes) ? q.mes : mesHoje, q.mes && q.mes !== mesHoje ? undefined : "Este mês");
}

// Agrupa datas do período em semanas do mês ("Semana 2"), semanas ("sem. 03/11") ou meses ("11/26")
function agrupador(ini: string, fim: string) {
  const n = difDias(ini, fim) + 1;
  if (n > 62) {
    const cats: string[] = []; for (let m = ini.slice(0, 7); m <= fim.slice(0, 7); m = somaMes(m, 1)) cats.push(rot(m));
    return { cats, de: (d: string) => rot(d.slice(0, 7)) };
  }
  const mesmoMes = ini.slice(0, 7) === fim.slice(0, 7);
  const rotulo = (d: string) => {
    if (!mesmoMes) return `sem. ${br(segunda(d) < ini ? ini : segunda(d))}`;
    const primeiro = `${d.slice(0, 7)}-01`;
    const desloc = (D(primeiro).getUTCDay() + 6) % 7;
    return `Semana ${Math.ceil((Number(d.slice(8, 10)) + desloc) / 7)}`;
  };
  const cats: string[] = [];
  for (let d = ini; d <= fim; d = addDias(d, 1)) { const r = rotulo(d); if (!cats.includes(r)) cats.push(r); }
  return { cats, de: rotulo };
}

function Tabela({ cab, linhas }: { cab: string[]; linhas: (string | number)[][] }) {
  if (!linhas.length) return <div className="muted">Sem dados.</div>;
  return (
    <table className="table" style={{ fontSize: 13 }}>
      <thead><tr>{cab.map((c, i) => <th key={c} style={{ textAlign: i ? "right" : "left", padding: "6px 4px" }}>{c}</th>)}</tr></thead>
      <tbody>
        {linhas.map((l, i) => (
          <tr key={i}>{l.map((c, j) => <td key={j} style={{ textAlign: j ? "right" : "left", padding: "6px 4px" }}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

const Secao = ({ titulo, sub }: { titulo: string; sub?: string }) => (
  <h2 style={{ margin: "22px 0 10px", fontSize: 18 }}>{titulo}{sub && <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}> · {sub}</span>}</h2>
);
const Cartao = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <section className="card"><h3 style={{ margin: "0 0 8px" }}>{titulo}</h3>{children}</section>
);

export default async function Painel({ searchParams }: { searchParams: Promise<{ mes?: string; p?: string; de?: string; ate?: string; comparar?: string }> }) {
  const q = await searchParams;
  const { supabase, perfil } = await getContexto();
  if (!podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro")) redirect("/dashboard");
  const hoje = hojeBR();
  const mesHoje = hoje.slice(0, 7);
  const P = periodo(q, hoje);
  const comparar = q.comparar === "1";
  const { ini, fim, antIni, antFim } = P;
  const M = fim.slice(0, 7);
  const meses = Array.from({ length: 12 }, (_, i) => somaMes(M, i - 11));
  const desde = [`${meses[0]}-01`, antIni].sort()[0];
  const diasDec = Math.max(1, difDias(ini, fim < hoje ? fim : hoje < ini ? ini : hoje) + 1);
  const diasAnt = difDias(antIni, antFim) + 1;

  const [fin, vendas, os, pessoas, clientes, pecas] = await Promise.all([
    tudo(() => supabase.from("finance_entries").select("kind,amount,paid_at,due_date,category,payment_method,tipo:legacy_data->>tipo_categoria").order("id")),
    tudo(() => supabase.from("sales").select("id,sold_at,total,seller,clients(name)").gte("sold_at", desde).order("id")),
    tudo(() => supabase.from("service_orders").select("id,status,entry_at,closed_at,technician_id,created_by,deadline,situacao,origem,legacy_ref,tec:legacy_data->lista->>tecnico,atd:legacy_data->lista->>atendente,marcaLeg:legacy_data->lista->equipamentos->0->>marca,vt:legacy_data->lista->>valorTotal,vp:legacy_data->lista->>valorProdutos,vs:legacy_data->lista->>valorServicos,vdp:legacy_data->lista->>valorDescProdutos,vds:legacy_data->lista->>valorDescServicos,clients(name,neighborhood),equipment(brand)").order("id")),
    supabase.from("profiles").select("id,full_name"),
    tudo(() => supabase.from("clients").select("registered_at,created_at").order("id")),
    tudo(() => supabase.from("parts").select("id,legacy_ref,pc:legacy_data->>precoCompra").order("id")),
  ]);
  const nomePessoa = (id: string | null) => ((pessoas.data as any[]) ?? []).find((p) => p.id === id)?.full_name as string | undefined;
  // Nome vindo do Inforos ("Diego Dias De Morais") vira o nome da conta no InforGest ("Diego Morais"):
  // mesmo primeiro nome e (mesmo último sobrenome ou único com esse primeiro nome)
  const perfis = ((pessoas.data as any[]) ?? []).map((p) => ({ nome: String(p.full_name ?? ""), t: norm(p.full_name).split(/\s+/) }));
  const unifica = (nome: any) => {
    const t = norm(nome).split(/\s+/).filter(Boolean);
    if (!t.length) return undefined;
    const mesmos = perfis.filter((p) => p.t[0] === t[0]);
    const achou = mesmos.find((p) => t.includes(p.t[p.t.length - 1])) ?? (mesmos.length === 1 ? mesmos[0] : undefined);
    return achou?.nome ?? String(nome).trim();
  };
  const tecnico = (o: any) => nomePessoa(o.technician_id) ?? unifica(o.tec) ?? "Sem técnico";
  const atendente = (o: any) => unifica(o.atd) ?? nomePessoa(o.created_by) ?? "Sem atendente";
  const custoPorId = new Map((pecas as any[]).map((p) => [p.id, Number(p.pc) || 0]));
  const custoPorRef = new Map((pecas as any[]).filter((p) => p.legacy_ref).map((p) => [String(p.legacy_ref), Number(p.pc) || 0]));

  // ---------- OS: quais entram em cada conta ----------
  const fechada = (o: any) => ["concluido", "faturado", "finalizado"].includes(o.status);
  const abertasNo = (a: string, b: string) => os.filter((o: any) => no(diaSP(o.entry_at), a, b));
  const concluidasNo = (a: string, b: string) => os.filter((o: any) => fechada(o) && no(diaSP(o.closed_at), a, b));
  const finalizadasNo = (a: string, b: string) => os.filter((o: any) => o.status === "finalizado" && no(diaSP(o.closed_at), a, b));
  const novas = abertasNo(ini, fim), concl = concluidasNo(ini, fim), finais = finalizadasNo(ini, fim);
  const finaisAnt = finalizadasNo(antIni, antFim);
  const emAndamento = os.filter((o: any) => o.status === "andamento");
  const statusConcluido = os.filter((o: any) => o.status === "concluido");
  const canceladas = os.filter((o: any) => o.status === "cancelado" && no(diaSP(o.closed_at) || diaSP(o.entry_at), ini, fim));

  // Valores de cada OS: do Inforos (valorTotal/produtos/serviços) ou, se criada no InforGest, soma dos itens
  type Val = { valor: number; pecas: number; servicos: number; custo: number; servs: { nome: string; qtd: number; valor: number }[] };
  const val = new Map<string, Val>();
  const precisa = new Map<string, any>();
  for (const o of [...novas, ...finais, ...finaisAnt, ...emAndamento, ...statusConcluido]) precisa.set(o.id, o);
  const nativas: string[] = [], legadasDetalhe: string[] = [];
  const idsFinais = new Set(finais.map((o: any) => o.id));
  for (const o of precisa.values()) {
    if (o.vt === null || o.vt === undefined) { nativas.push(o.id); continue; }
    val.set(o.id, { valor: Number(o.vt) || 0, pecas: (Number(o.vp) || 0) - (Number(o.vdp) || 0), servicos: (Number(o.vs) || 0) - (Number(o.vds) || 0), custo: 0, servs: [] });
    if (idsFinais.has(o.id)) legadasDetalhe.push(o.id);
  }
  for (let i = 0; i < legadasDetalhe.length; i += 150) {
    const { data } = await supabase.from("service_orders").select("id,itens:legacy_data->detalhe->itens").in("id", legadasDetalhe.slice(i, i + 150));
    for (const r of (data as any[]) ?? []) {
      const v = val.get(r.id)!;
      for (const p of r.itens?.produtos ?? []) v.custo += (Number(p.quantidade) || 0) * (custoPorRef.get(String(p.codigo)) ?? 0);
      for (const s of r.itens?.servicos ?? []) v.servs.push({ nome: String(s.nome ?? "(sem nome)"), qtd: Number(s.quantidade) || 1, valor: Number(s.subTotal) || 0 });
    }
  }
  for (const id of nativas) val.set(id, { valor: 0, pecas: 0, servicos: 0, custo: 0, servs: [] });
  for (let i = 0; i < nativas.length; i += 150) {
    const { data: itens } = await supabase.from("service_order_items").select("id,order_id,kind,description,quantity,part_id").in("order_id", nativas.slice(i, i + 150));
    const lista = (itens as any[]) ?? [];
    for (let j = 0; j < lista.length; j += 150) {
      const parte = lista.slice(j, j + 150);
      const { data: precos } = await supabase.from("item_prices").select("item_id,unit_price").in("item_id", parte.map((x) => x.id));
      const mapa = new Map(((precos as any[]) ?? []).map((p) => [p.item_id, Number(p.unit_price)]));
      for (const it of parte) {
        const v = val.get(it.order_id)!; const qtd = Number(it.quantity) || 0; const total = qtd * (mapa.get(it.id) ?? 0);
        v.valor += total;
        if (it.kind === "peca") { v.pecas += total; v.custo += qtd * (custoPorId.get(it.part_id) ?? 0); }
        else { v.servicos += total; v.servs.push({ nome: String(it.description ?? "(sem nome)"), qtd, valor: total }); }
      }
    }
  }
  const V = (o: any) => val.get(o.id) ?? { valor: 0, pecas: 0, servicos: 0, custo: 0, servs: [] };
  const somaV = (l: any[], k: keyof Omit<Val, "servs">) => l.reduce((t, o) => t + V(o)[k], 0);

  const faturadoOS = somaV(finais, "valor"), vendaPecas = somaV(finais, "pecas"), vendaServicos = somaV(finais, "servicos"), compraPecas = somaV(finais, "custo");
  const faturadoAnt = somaV(finaisAnt, "valor");
  const ticket = finais.length ? faturadoOS / finais.length : 0;
  const ticketAnt = finaisAnt.length ? faturadoAnt / finaisAnt.length : 0;
  const recusadas = finais.filter((o: any) => norm(o.situacao).startsWith("recusad")).length;
  const semReparo = finais.filter((o: any) => /sem[_ ]?reparo/.test(norm(o.situacao))).length;
  const novosClientes = (a: string, b: string) => (clientes as any[]).filter((c) => no(diaSP(c.registered_at ?? c.created_at), a, b)).length;
  const nCli = novosClientes(ini, fim), nCliAnt = novosClientes(antIni, antFim);
  const novasAnt = abertasNo(antIni, antFim).length;

  const G = agrupador(ini, fim);
  const porGrupo = (l: any[], data: (x: any) => string, valor: (x: any) => number) => G.cats.map((c) => l.filter((x) => G.de(data(x)) === c).reduce((t, x) => t + valor(x), 0));

  const origem: Record<string, number> = {}, origemValor: Record<string, number> = {};
  for (const o of novas) { const k = o.origem || "Não informada"; somaEm(origem, k, 1); somaEm(origemValor, k, V(o).valor); }
  const porAtendente: Record<string, number> = {}, porTecnicoValor: Record<string, number> = {}, servPorTecnico: Record<string, number> = {}, porCliOS: Record<string, number> = {};
  for (const o of finais) {
    somaEm(porAtendente, atendente(o), V(o).valor); somaEm(porTecnicoValor, tecnico(o), V(o).valor);
    somaEm(servPorTecnico, tecnico(o), V(o).servicos); somaEm(porCliOS, (o as any).clients?.name ?? "—", V(o).valor);
  }
  const servicos: Record<string, { qtd: number; valor: number }> = {};
  for (const o of finais) for (const s of V(o).servs) { const k = s.nome.trim(); (servicos[k] ??= { qtd: 0, valor: 0 }).qtd += s.qtd; servicos[k].valor += s.valor; }
  const marcas: Record<string, number> = {}, bairros: Record<string, number> = {};
  for (const o of novas) {
    const m = (o as any).equipment?.brand || o.marcaLeg; if (m) somaEm(marcas, String(m).trim().toUpperCase(), 1);
    const b = (o as any).clients?.neighborhood; if (b) somaEm(bairros, String(b).trim(), 1);
  }
  const conclTec: Record<string, number> = {}, finaisTec: Record<string, number> = {}, prazoTot: Record<string, number> = {}, prazoOk: Record<string, number> = {};
  for (const o of concl) {
    const t = tecnico(o); somaEm(conclTec, t, 1);
    if (o.deadline && t !== "Sem técnico") { somaEm(prazoTot, t, 1); if (diaSP(o.closed_at) <= String(o.deadline).slice(0, 10)) somaEm(prazoOk, t, 1); }
  }
  for (const o of finais) somaEm(finaisTec, tecnico(o), 1);
  const noPrazo = Object.keys(prazoTot).map((t) => ({ nome: `${t} (${prazoOk[t] ?? 0} de ${prazoTot[t]})`, valor: pct(prazoOk[t] ?? 0, prazoTot[t]) })).sort((a, b) => b.valor - a.valor);
  const statusN: Record<string, number> = {};
  for (const o of os) statusN[o.status] = (statusN[o.status] ?? 0) + 1;

  // ---------- vendas ----------
  const vendasPer = vendas.filter((v: any) => no(dataCol(v.sold_at), ini, fim));
  const totalVendas = soma(vendasPer), totalVendasAnt = soma(vendas.filter((v: any) => no(dataCol(v.sold_at), antIni, antFim)));
  const porVendedor: Record<string, number> = {}, porCliente: Record<string, number> = {};
  for (const v of vendasPer as any[]) { somaEm(porVendedor, unifica(v.seller) ?? "Sem vendedor", Number(v.total)); somaEm(porCliente, v.clients?.name ?? "Consumidor", Number(v.total)); }
  const produtos: Record<string, { qtd: number; valor: number }> = {};
  const idsVenda = (vendasPer as any[]).map((v) => v.id);
  for (let i = 0; i < idsVenda.length; i += 150) {
    const { data } = await supabase.from("sale_items").select("description,quantity,unit_price,discount,leg:legacy_data->>valor").in("sale_id", idsVenda.slice(i, i + 150));
    for (const it of (data as any[]) ?? []) {
      const k = String(it.description ?? "(sem descrição)").split(" — ")[0].trim(); const qtd = Number(it.quantity) || 0;
      // itens importados do Inforos: "valor" já é o total da linha
      const linha = it.leg !== null && it.leg !== undefined ? Number(it.leg) || 0 : qtd * (Number(it.unit_price) || 0) - (Number(it.discount) || 0);
      (produtos[k] ??= { qtd: 0, valor: 0 }).qtd += qtd; produtos[k].valor += linha;
    }
  }

  // ---------- financeiro ----------
  const pagoNo = (k: string, a: string, b: string) => fin.filter((l: any) => l.kind === k && no(dataCol(l.paid_at), a, b));
  const pagoNoMes = (k: string, m: string) => fin.filter((l: any) => l.kind === k && dataCol(l.paid_at).slice(0, 7) === m);
  const abertos = fin.filter((l: any) => !l.paid_at);
  const pendNo = (k: string) => abertos.filter((l: any) => l.kind === k && no(dataCol(l.due_date), ini, fim));
  const rec = soma(pagoNo("receita", ini, fim)), des = soma(pagoNo("despesa", ini, fim));
  const recAnt = soma(pagoNo("receita", antIni, antFim)), desAnt = soma(pagoNo("despesa", antIni, antFim));
  const pendRec = soma(pendNo("receita")), pendDes = soma(pendNo("despesa"));
  const provRec = rec + pendRec, provDes = des + pendDes;
  const geralRec = soma(abertos.filter((l: any) => l.kind === "receita")), geralDes = soma(abertos.filter((l: any) => l.kind === "despesa"));
  const atraso = soma(abertos.filter((l: any) => l.kind === "receita" && dataCol(l.due_date) < hoje));
  const agrupa = (l: any[], campo: string, vazio: string) => { const r: Record<string, number> = {}; for (const x of l) somaEm(r, (x[campo] || vazio) as string, Number(x.amount)); return r; };
  const recCat = agrupa(pagoNo("receita", ini, fim), "category", "Sem categoria");
  const desCat = agrupa(pagoNo("despesa", ini, fim), "category", "Sem categoria");
  const desTipo = agrupa(pagoNo("despesa", ini, fim), "tipo", "Sem tipo");
  const formaRec = agrupa(pagoNo("receita", ini, fim), "payment_method", "Não informada");
  const formaDes = agrupa(pagoNo("despesa", ini, fim), "payment_method", "Não informada");
  // dia a dia: pago na data do pagamento; em aberto na data do vencimento
  const dias: string[] = [];
  if (difDias(ini, fim) <= 62) for (let d = ini; d <= fim; d = addDias(d, 1)) dias.push(d);
  const diaLanc = (l: any) => dataCol(l.paid_at) || dataCol(l.due_date);
  const noDia = (k: string, d: string) => soma(fin.filter((l: any) => l.kind === k && diaLanc(l) === d && (l.paid_at || no(dataCol(l.due_date), ini, fim))));

  const resultado = rec - des;
  const variacao = (a: number, b: number) => (b ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}% vs período anterior` : "sem período anterior");
  const cmp = (a: number, b: number, txt?: string) => (comparar ? variacao(a, b) : txt);
  const titulo = P.rotulo || `${["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][Number(M.slice(5)) - 1]} de ${M.slice(0, 4)}`;

  return (
    <main className="wrap" id="painel-gestao" style={{ background: "var(--bg)", overflow: "auto" }}>
      <div className="headrow" style={{ marginBottom: 14, alignItems: "flex-start" }}>
        <div>
          <h1 className="title">Painel de gestão</h1>
          <p className="muted">{titulo} · {brAno(ini)} a {brAno(fim)}{comparar && ` · comparando com ${brAno(antIni)} a ${brAno(antFim)}`}</p>
        </div>
        <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
          <Controles p={P.p} de={ini} ate={fim} comparar={comparar} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {P.mes && <Link className="btn secondary" href={`/painel?mes=${somaMes(P.mes, -1)}${comparar ? "&comparar=1" : ""}`}>← {rot(somaMes(P.mes, -1))}</Link>}
            {P.mes && P.mes !== mesHoje && <Link className="btn secondary" href={`/painel${comparar ? "?comparar=1" : ""}`}>Mês atual</Link>}
            {P.mes && P.mes < mesHoje && <Link className="btn secondary" href={`/painel?mes=${somaMes(P.mes, 1)}${comparar ? "&comparar=1" : ""}`}>{rot(somaMes(P.mes, 1))} →</Link>}
            <Link className="btn secondary" href="/metricas">Métricas detalhadas</Link>
          </div>
        </div>
      </div>

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Indicador titulo="Receitas pagas" valor={moeda(rec)} sub={variacao(rec, recAnt)} cor="#3ccf91" />
        <Indicador titulo="Despesas pagas" valor={moeda(des)} sub={variacao(des, desAnt)} cor="#ff7a7a" />
        <Indicador titulo="Resultado do período" valor={moeda(resultado)} sub={cmp(resultado, recAnt - desAnt, resultado >= 0 ? "positivo" : "negativo")} cor={resultado >= 0 ? "#3ccf91" : "#ff7a7a"} />
        <Indicador titulo="Vendas" valor={moeda(totalVendas)} sub={cmp(totalVendas, totalVendasAnt, `${vendasPer.length} venda(s)`)} cor="#ff9f43" href="/vendas" />
        <Indicador titulo="A receber (vence no período)" valor={moeda(pendRec)} cor="#4ea1ff" href="/financeiro" />
        <Indicador titulo="A pagar (vence no período)" valor={moeda(pendDes)} cor="#f6c500" href="/financeiro" />
        <Indicador titulo="Faturado em OS" valor={moeda(faturadoOS)} sub={cmp(faturadoOS, faturadoAnt, `${finais.length} OS finalizada(s)`)} cor="#b48cff" href="/os" />
        <Indicador titulo="Ticket médio por OS" valor={moeda(ticket)} sub={cmp(ticket, ticketAnt, "faturado ÷ OS finalizadas")} cor="#5fd0e0" />
        <Indicador titulo="Venda de peças (OS)" valor={moeda(vendaPecas)} cor="#3ccf91" />
        <Indicador titulo="Venda de serviços (OS)" valor={moeda(vendaServicos)} cor="#4ea1ff" />
        <Indicador titulo="Compra de peças (OS)" valor={moeda(compraPecas)} sub="custo das peças usadas" cor="#ff7a7a" />
        <Indicador titulo="Lucro parcial (OS)" valor={moeda(faturadoOS - compraPecas)} sub={`margem das peças ${moeda(vendaPecas - compraPecas)}`} cor="#3ccf91" />
      </div>

      <div className="grid g2" style={{ marginBottom: 14 }}>
        <Cartao titulo="Receitas x despesas (12 meses)">
          <Barras dinheiro categorias={meses.map(rot)} series={[
            { nome: "Receitas", cor: "#3ccf91", valores: meses.map((m) => soma(pagoNoMes("receita", m))) },
            { nome: "Despesas", cor: "#ff7a7a", valores: meses.map((m) => soma(pagoNoMes("despesa", m))) },
          ]} />
        </Cartao>
        <Cartao titulo="Vendas por mês (12 meses)">
          <Linhas dinheiro categorias={meses.map(rot)} series={[
            { nome: "Vendas", cor: "#ff9f43", valores: meses.map((m) => soma(vendas.filter((v: any) => dataCol(v.sold_at).slice(0, 7) === m))) },
          ]} />
        </Cartao>
      </div>

      <Secao titulo="Ordens de serviço" sub="aprovação e recusa sobre as OS finalizadas no período" />
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Indicador titulo="Taxa de aprovação" valor={pctTxt(pct(finais.length - recusadas - semReparo, finais.length))} sub="aprovadas" cor="#3ccf91" />
        <Indicador titulo="Recusadas" valor={pctTxt(pct(recusadas, finais.length))} sub={`${recusadas} OS`} cor="#ff7a7a" />
        <Indicador titulo="Sem reparo" valor={pctTxt(pct(semReparo, finais.length))} sub={`${semReparo} OS`} cor="#9db0c9" />
        <Indicador titulo="Em andamento agora" valor={String(emAndamento.length)} sub={`${moeda(somaV(emAndamento, "valor"))} · sem filtro de período`} cor="#4ea1ff" href="/os" />
        <Indicador titulo="Novas OS" valor={String(novas.length)} sub={cmp(novas.length, novasAnt, `${n1(novas.length / diasDec)} por dia · ${moeda(somaV(novas, "valor"))}`)} cor="#4ea1ff" />
        <Indicador titulo="Novos clientes" valor={String(nCli)} sub={cmp(nCli, nCliAnt, `${n1(nCli / diasDec)} por dia`)} cor="#ff9f43" href="/clientes" />
        <Indicador titulo="Concluídas" valor={String(concl.length)} sub="concluído, faturado ou finalizado no período" cor="#3ccf91" />
        <Indicador titulo="Finalizadas" valor={String(finais.length)} sub={cmp(finais.length, finaisAnt.length, `canceladas: ${canceladas.length}`)} cor="#b48cff" />
        <Indicador titulo="OS com status Concluído" valor={moeda(somaV(statusConcluido, "valor"))} sub={`${statusConcluido.length} OS · sem filtro de período`} cor="#f6c500" href="/os" />
      </div>

      <div className="grid g3" style={{ marginBottom: 14 }}>
        <Cartao titulo="Faturamento por semana (OS finalizadas)">
          <Barras dinheiro categorias={G.cats} series={[{ nome: "Faturado", cor: "#b48cff", valores: porGrupo(finais, (o) => diaSP(o.closed_at), (o) => V(o).valor) }]} />
        </Cartao>
        <Cartao titulo="Faturado por atendente"><Rosca dinheiro itens={topo(porAtendente, 7)} centro={moeda(faturadoOS)} /></Cartao>
        <Cartao titulo="Faturado por técnico"><Rosca dinheiro itens={topo(porTecnicoValor, 7)} centro={moeda(faturadoOS)} /></Cartao>
      </div>

      <div className="grid g3" style={{ marginBottom: 14 }}>
        <Cartao titulo="Origem das OS (novas)">
          <Rosca itens={topo(origem, 7)} />
          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>{topo(origemValor, 7).map((o) => `${o.nome}: ${moeda(o.valor)}`).join(" · ")}</div>
        </Cartao>
        <Cartao titulo="Ordens de serviço por status"><Rosca itens={Object.entries(STATUS_OS).map(([k, n]) => ({ nome: n, valor: statusN[k] ?? 0 }))} /></Cartao>
        <Cartao titulo="OS abertas x fechadas (12 meses)">
          <Barras categorias={meses.map(rot)} series={[
            { nome: "Abertas", cor: "#4ea1ff", valores: meses.map((m) => os.filter((o: any) => mesDe(o.entry_at) === m).length) },
            { nome: "Fechadas", cor: "#3ccf91", valores: meses.map((m) => os.filter((o: any) => mesDe(o.closed_at) === m).length) },
          ]} />
        </Cartao>
      </div>

      <div className="grid g2" style={{ marginBottom: 14 }}>
        <Cartao titulo="Serviços mais realizados (OS finalizadas)">
          <Tabela cab={["Serviço", "Qtd", "Valor"]} linhas={Object.entries(servicos).sort((a, b) => b[1].qtd - a[1].qtd || b[1].valor - a[1].valor).slice(0, 10).map(([n, s]) => [n, n1(s.qtd), moeda(s.valor)])} />
        </Cartao>
        <Cartao titulo="Top 5 clientes (OS finalizadas)">
          <Tabela cab={["Cliente", "Valor total"]} linhas={topo(porCliOS, 5).map((c) => [c.nome, moeda(c.valor)])} />
        </Cartao>
      </div>

      <div className="grid g2" style={{ marginBottom: 14 }}>
        <Cartao titulo="Top 5 marcas (OS novas)"><BarrasH itens={topo(marcas, 5)} cor="#4ea1ff" /></Cartao>
        <Cartao titulo="Top 5 bairros (OS novas)"><BarrasH itens={topo(bairros, 5)} cor="#ff9f43" /></Cartao>
      </div>

      <Secao titulo="Técnicos" />
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Cartao titulo="No prazo (OS concluídas)">
          {noPrazo.length ? <BarrasH itens={noPrazo} sufixo="%" max={100} cor="#3ccf91" /> : <div className="muted">Nenhuma OS com prazo concluída no período.</div>}
        </Cartao>
        <Cartao titulo="Concluídas por técnico"><BarrasH itens={topo(conclTec, 8)} cor="#4ea1ff" /></Cartao>
        <Cartao titulo="Finalizadas por técnico"><BarrasH itens={topo(finaisTec, 8)} cor="#b48cff" /></Cartao>
        <Cartao titulo="Serviços por técnico (R$)"><BarrasH dinheiro itens={topo(servPorTecnico, 8)} cor="#5fd0e0" /></Cartao>
      </div>

      <Secao titulo="Vendas" sub={`${moeda(totalVendas)} em ${vendasPer.length} venda(s)`} />
      <div className="grid g3" style={{ marginBottom: 14 }}>
        <Cartao titulo="Vendas por semana">
          <Barras dinheiro categorias={G.cats} series={[{ nome: "Vendas", cor: "#ff9f43", valores: porGrupo(vendasPer, (v) => dataCol(v.sold_at), (v) => Number(v.total)) }]} />
        </Cartao>
        <Cartao titulo="Vendas por vendedor"><Rosca dinheiro itens={topo(porVendedor, 7)} centro={moeda(totalVendas)} /></Cartao>
        <Cartao titulo="Ranking de vendedores"><BarrasH dinheiro itens={topo(porVendedor, 8)} cor="#ff9f43" /></Cartao>
      </div>
      <div className="grid g2" style={{ marginBottom: 14 }}>
        <Cartao titulo="Produtos mais vendidos">
          <Tabela cab={["Produto", "Qtd", "Valor"]} linhas={Object.entries(produtos).sort((a, b) => b[1].valor - a[1].valor).slice(0, 10).map(([n, s]) => [n, n1(s.qtd), moeda(s.valor)])} />
        </Cartao>
        <Cartao titulo="Maiores clientes (vendas)"><BarrasH dinheiro itens={topo(porCliente, 8)} /></Cartao>
      </div>

      <Secao titulo="Financeiro" sub="pago = data do pagamento · pendente = vence no período e ainda não foi pago" />
      <div className="grid g4" style={{ marginBottom: 14 }}>
        <Indicador titulo="Receita prevista (paga + pendente)" valor={moeda(provRec)} sub={`pendente ${moeda(pendRec)}`} cor="#3ccf91" />
        <Indicador titulo="Despesa prevista (paga + pendente)" valor={moeda(provDes)} sub={`pendente ${moeda(pendDes)}`} cor="#ff7a7a" />
        <Indicador titulo="Margem prevista" valor={moeda(provRec - provDes)} cor={provRec - provDes >= 0 ? "#3ccf91" : "#ff7a7a"} />
        <Indicador titulo="Pendente geral (tudo em aberto)" valor={moeda(geralRec)} sub={`a pagar: ${moeda(geralDes)}`} cor="#4ea1ff" href="/financeiro" />
      </div>
      {dias.length > 0 && (
        <section className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ margin: "0 0 8px" }}>Receitas e despesas dia a dia (pagas e a vencer)</h3>
          <Barras dinheiro categorias={dias.map(br)} series={[
            { nome: "Receitas", cor: "#3ccf91", valores: dias.map((d) => noDia("receita", d)) },
            { nome: "Despesas", cor: "#ff7a7a", valores: dias.map((d) => noDia("despesa", d)) },
          ]} />
        </section>
      )}
      <div className="grid g3" style={{ marginBottom: 14 }}>
        <Cartao titulo="Receitas por categoria"><Rosca dinheiro itens={topo(recCat, 7)} centro={moeda(rec)} /></Cartao>
        <Cartao titulo="Receitas por forma de pagamento"><Rosca dinheiro itens={topo(formaRec, 7)} centro={moeda(rec)} /></Cartao>
        <Cartao titulo="Inadimplência">
          <Medidor pct={geralRec ? (atraso / geralRec) * 100 : 0} rotulo="em atraso do a receber" cor="#ff7a7a" />
          <div className="muted" style={{ textAlign: "center", marginTop: 6 }}>{moeda(atraso)} de {moeda(geralRec)}</div>
        </Cartao>
      </div>
      <div className="grid g3">
        <Cartao titulo="Tipo de despesas"><Rosca dinheiro itens={topo(desTipo, 7)} centro={moeda(des)} /></Cartao>
        <Cartao titulo="Despesas por forma de pagamento"><Rosca dinheiro itens={topo(formaDes, 7)} centro={moeda(des)} /></Cartao>
        <Cartao titulo="Despesas por categoria"><BarrasH dinheiro itens={topo(desCat, 12)} cor="#ff7a7a" /></Cartao>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>Período anterior usado nas comparações: {brAno(antIni)} a {brAno(antFim)} ({diasAnt} dias).</p>
    </main>
  );
}
