import { tudo } from "@/lib/paginar";
import { fmtData, moeda } from "@/lib/format";
import { STATUS_OS } from "@/lib/os";

export type Filtros = { de: string; ate: string; q: string; status: string };
export type Resultado = { cols: string[]; rows: string[][]; cards: { t: string; v: string; cor?: string }[] };
export type Relatorio = { titulo: string; dataRotulo: string; statusOpcoes?: [string, string][]; carregar: (sb: any, f: Filtros) => Promise<Resultado> };

const ini = (d: string) => d + "T00:00:00-03:00";
const fim = (d: string) => d + "T23:59:59-03:00";
const has = (f: Filtros, ...campos: any[]) => !f.q || campos.filter(Boolean).some((c) => String(c).toLowerCase().includes(f.q.toLowerCase()));
const soma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

async function valoresOS(sb: any, ids: string[]) {
  const val: Record<string, number> = {};
  for (let i = 0; i < ids.length; i += 80) {
    const c = ids.slice(i, i + 80);
    const [{ data: its }, { data: fin }] = await Promise.all([
      sb.from("service_order_items").select("id, order_id, quantity, item_prices(unit_price)").in("order_id", c),
      sb.from("order_finance").select("order_id, discount").in("order_id", c),
    ]);
    for (const it of its ?? []) {
      const p = Array.isArray(it.item_prices) ? it.item_prices[0] : it.item_prices;
      val[it.order_id] = (val[it.order_id] ?? 0) + Number(it.quantity) * Number(p?.unit_price ?? 0);
    }
    for (const f of fin ?? []) val[f.order_id] = Math.max((val[f.order_id] ?? 0) - Number(f.discount ?? 0), 0);
  }
  return val;
}

export const RELATORIOS: Record<string, Relatorio> = {
  clientes: {
    titulo: "Clientes",
    dataRotulo: "Cadastrado",
    statusOpcoes: [["ativo", "Ativos"], ["inativo", "Inativos"]],
    async carregar(sb, f) {
      const d = await tudo(() => sb.from("clients").select("name, document, phone, mobile, city, state, client_type, person_type, active, created_at").gte("created_at", ini(f.de)).lte("created_at", fim(f.ate)).order("name"));
      const l = d.filter((c: any) => has(f, c.name, c.document, c.phone, c.mobile, c.city) && (!f.status || (f.status === "ativo") === (c.active !== false)));
      return {
        cols: ["Nome", "Documento", "Telefone", "Cidade", "Tipo", "Status"],
        rows: l.map((c: any) => [c.name, c.document ?? "", c.mobile || c.phone || "", [c.city, c.state].filter(Boolean).join("/"), c.client_type ?? "", c.active === false ? "Inativo" : "Ativo"]),
        cards: [
          { t: "Total de clientes", v: String(l.length) },
          { t: "Clientes ativos", v: String(l.filter((c: any) => c.active !== false).length), cor: "#16a34a" },
          { t: "Clientes inativos", v: String(l.filter((c: any) => c.active === false).length), cor: "#dc2626" },
          { t: "Pessoa física", v: String(l.filter((c: any) => c.person_type === "pf").length) },
          { t: "Pessoa jurídica", v: String(l.filter((c: any) => c.person_type === "pj").length) },
        ],
      };
    },
  },
  equipamentos: {
    titulo: "Equipamentos",
    dataRotulo: "Cadastrado",
    async carregar(sb, f) {
      const d = await tudo(() => sb.from("equipment").select("asset_tag, code, equipment_type, brand, model, serial_number, status, contract_id, clients(name), created_at").gte("created_at", ini(f.de)).lte("created_at", fim(f.ate)).order("created_at", { ascending: false }));
      const l = d.filter((e: any) => has(f, e.asset_tag, e.code, e.brand, e.model, e.serial_number, e.clients?.name));
      return {
        cols: ["Etiqueta", "Equipamento", "Cliente", "Marca", "Modelo", "Nº série", "Contrato", "Status"],
        rows: l.map((e: any) => [e.asset_tag ?? e.code ?? "", e.equipment_type ?? "", e.clients?.name ?? "", e.brand ?? "", e.model ?? "", e.serial_number ?? "", e.contract_id ? "Contrato" : "Avulso", e.status ?? ""]),
        cards: [
          { t: "Total de equipamentos", v: String(l.length) },
          { t: "Em contrato", v: String(l.filter((e: any) => e.contract_id).length), cor: "#2563eb" },
          { t: "Avulsos", v: String(l.filter((e: any) => !e.contract_id).length) },
        ],
      };
    },
  },
  servicos: {
    titulo: "Serviços",
    dataRotulo: "Entrada da OS",
    async carregar(sb, f) {
      const d = await tudo(() => sb.from("service_order_items").select("description, quantity, order_id, item_prices(unit_price), service_orders!inner(number, entry_at, clients(name))").eq("kind", "servico").gte("service_orders.entry_at", ini(f.de)).lte("service_orders.entry_at", fim(f.ate)).order("created_at", { ascending: false }));
      const l = d.filter((i: any) => has(f, i.description, i.service_orders?.clients?.name, i.service_orders?.number));
      const v = (i: any) => Number(i.quantity) * Number((Array.isArray(i.item_prices) ? i.item_prices[0] : i.item_prices)?.unit_price ?? 0);
      return {
        cols: ["OS", "Data", "Cliente", "Serviço", "Qtd", "Valor"],
        rows: l.map((i: any) => ["#" + i.service_orders?.number, fmtData(i.service_orders?.entry_at), i.service_orders?.clients?.name ?? "", i.description, String(Number(i.quantity)), moeda(v(i))]),
        cards: [
          { t: "Serviços lançados", v: String(l.length) },
          { t: "Quantidade", v: String(soma(l.map((i: any) => Number(i.quantity)))) },
          { t: "Valor total", v: moeda(soma(l.map(v))), cor: "#16a34a" },
        ],
      };
    },
  },
  compras: {
    titulo: "Compras",
    dataRotulo: "Data da compra",
    statusOpcoes: [["faturado", "Faturadas"], ["nao", "Não faturadas"]],
    async carregar(sb, f) {
      const d = await tudo(() => sb.from("purchases").select("id, number, purchased_at, discount, legacy_total, invoiced, suppliers(name), purchase_items(quantity, unit_price, discount), purchase_costs(amount)").gte("purchased_at", ini(f.de)).lte("purchased_at", fim(f.ate)).order("purchased_at", { ascending: false }));
      const tot = (c: any) => (c.purchase_items?.length ? Math.max(soma(c.purchase_items.map((i: any) => Number(i.quantity) * Number(i.unit_price) - Number(i.discount))) + soma((c.purchase_costs ?? []).map((x: any) => Number(x.amount))) - Number(c.discount), 0) : Number(c.legacy_total ?? 0));
      const l = d.filter((c: any) => has(f, String(c.number), c.suppliers?.name) && (!f.status || (f.status === "faturado") === !!c.invoiced));
      return {
        cols: ["Nº", "Data", "Fornecedor", "Faturada", "Total"],
        rows: l.map((c: any) => ["#" + c.number, fmtData(c.purchased_at), c.suppliers?.name ?? "", c.invoiced ? "Sim" : "Não", moeda(tot(c))]),
        cards: [{ t: "Compras", v: String(l.length) }, { t: "Valor total", v: moeda(soma(l.map(tot))), cor: "#dc2626" }],
      };
    },
  },
  garantias: {
    titulo: "Garantias",
    dataRotulo: "Entrada da OS",
    async carregar(sb, f) {
      const d = await tudo(() => sb.from("service_orders").select("number, termo, status, entry_at, closed_at, clients(name), equipment(code, model)").eq("warranty", true).gte("entry_at", ini(f.de)).lte("entry_at", fim(f.ate)).order("number", { ascending: false }));
      const l = d.filter((o: any) => has(f, String(o.number), o.clients?.name, o.termo));
      return {
        cols: ["OS", "Cliente", "Equipamento", "Termo", "Entrada", "Finalizada em", "Status"],
        rows: l.map((o: any) => ["#" + o.number, o.clients?.name ?? "", o.equipment ? `${o.equipment.code} ${o.equipment.model ?? ""}` : "", o.termo ?? "", fmtData(o.entry_at), o.closed_at ? fmtData(o.closed_at) : "", STATUS_OS[o.status] ?? o.status]),
        cards: [{ t: "OS em garantia", v: String(l.length) }, { t: "Concluídas", v: String(l.filter((o: any) => ["concluido", "faturado", "finalizado"].includes(o.status)).length), cor: "#16a34a" }],
      };
    },
  },
  produtos: {
    titulo: "Produtos",
    dataRotulo: "Cadastrado",
    statusOpcoes: [["baixo", "Abaixo do mínimo"], ["zerado", "Sem estoque"]],
    async carregar(sb, f) {
      const d = await tudo(() => sb.from("parts").select("code, name, stock_quantity, minimum_stock, active, created_at").gte("created_at", ini(f.de)).lte("created_at", fim(f.ate)).order("name"));
      const l = d.filter((p: any) => has(f, p.code, p.name) && (!f.status || (f.status === "zerado" ? Number(p.stock_quantity) <= 0 : Number(p.stock_quantity) < Number(p.minimum_stock ?? 0))));
      return {
        cols: ["Código", "Produto", "Estoque", "Mínimo", "Status"],
        rows: l.map((p: any) => [p.code ?? "", p.name, String(Number(p.stock_quantity)), String(Number(p.minimum_stock ?? 0)), Number(p.stock_quantity) <= 0 ? "Sem estoque" : Number(p.stock_quantity) < Number(p.minimum_stock ?? 0) ? "Abaixo do mínimo" : "OK"]),
        cards: [
          { t: "Produtos", v: String(l.length) },
          { t: "Abaixo do mínimo", v: String(l.filter((p: any) => Number(p.stock_quantity) < Number(p.minimum_stock ?? 0)).length), cor: "#d97706" },
          { t: "Sem estoque", v: String(l.filter((p: any) => Number(p.stock_quantity) <= 0).length), cor: "#dc2626" },
        ],
      };
    },
  },
  os: {
    titulo: "Ordens de Serviço",
    dataRotulo: "Entrada",
    statusOpcoes: Object.entries(STATUS_OS) as [string, string][],
    async carregar(sb, f) {
      const d = await tudo(() => sb.from("service_orders").select("id, number, status, situacao, entry_at, deadline, technician_id, clients(name)").gte("entry_at", ini(f.de)).lte("entry_at", fim(f.ate)).order("number", { ascending: false }));
      const l = d.filter((o: any) => has(f, String(o.number), o.clients?.name, o.situacao) && (!f.status || o.status === f.status));
      const { data: pessoas } = await sb.from("profiles").select("id, full_name");
      const nome = (id: string) => (pessoas ?? []).find((p: any) => p.id === id)?.full_name ?? "";
      const val = await valoresOS(sb, l.map((o: any) => o.id));
      return {
        cols: ["OS", "Cliente", "Entrada", "Prazo", "Status", "Situação", "Técnico", "Valor"],
        rows: l.map((o: any) => ["#" + o.number, o.clients?.name ?? "", fmtData(o.entry_at), o.deadline ? fmtData(o.deadline) : "", STATUS_OS[o.status] ?? o.status, o.situacao ?? "", nome(o.technician_id), moeda(val[o.id] ?? 0)]),
        cards: [
          { t: "Total de OS", v: String(l.length) },
          { t: "Em aberto", v: String(l.filter((o: any) => !["concluido", "faturado", "finalizado", "cancelado"].includes(o.status)).length), cor: "#d97706" },
          { t: "Concluídas", v: String(l.filter((o: any) => ["concluido", "faturado", "finalizado"].includes(o.status)).length), cor: "#16a34a" },
          { t: "Valor total", v: moeda(soma(l.map((o: any) => val[o.id] ?? 0))), cor: "#2563eb" },
        ],
      };
    },
  },
  vendas: {
    titulo: "Vendas",
    dataRotulo: "Data da venda",
    statusOpcoes: [["faturado", "Faturadas"], ["nao", "Não faturadas"]],
    async carregar(sb, f) {
      const d = await tudo(() => sb.from("sales").select("number, sold_at, total, discount, billed, seller, clients(name)").gte("sold_at", ini(f.de)).lte("sold_at", fim(f.ate)).order("sold_at", { ascending: false }));
      const l = d.filter((v: any) => has(f, String(v.number), v.clients?.name, v.seller) && (!f.status || (f.status === "faturado") === !!v.billed));
      return {
        cols: ["Nº", "Data", "Cliente", "Vendedor", "Faturada", "Total"],
        rows: l.map((v: any) => ["#" + v.number, fmtData(v.sold_at), v.clients?.name ?? "", v.seller ?? "", v.billed ? "Sim" : "Não", moeda(Number(v.total))]),
        cards: [{ t: "Vendas", v: String(l.length) }, { t: "Valor total", v: moeda(soma(l.map((v: any) => Number(v.total)))), cor: "#16a34a" }],
      };
    },
  },
  financeiro: {
    titulo: "Financeiro",
    dataRotulo: "Vencimento",
    statusOpcoes: [["pago", "Pagos"], ["aberto", "Em aberto"]],
    async carregar(sb, f) {
      const d = await tudo(() => sb.from("finance_entries").select("kind, description, party, category, amount, due_date, paid_at, clients(name)").gte("due_date", f.de).lte("due_date", f.ate).order("due_date", { ascending: false }));
      const l = d.filter((e: any) => has(f, e.description, e.party, e.category, e.clients?.name) && (!f.status || (f.status === "pago") === !!e.paid_at));
      const rec = soma(l.filter((e: any) => e.kind === "receita").map((e: any) => Number(e.amount)));
      const des = soma(l.filter((e: any) => e.kind === "despesa").map((e: any) => Number(e.amount)));
      return {
        cols: ["Vencimento", "Tipo", "Descrição", "Cliente/Fornecedor", "Categoria", "Pago em", "Valor"],
        rows: l.map((e: any) => [fmtData(e.due_date), e.kind === "receita" ? "Receita" : "Despesa", e.description ?? "", e.clients?.name ?? e.party ?? "", e.category ?? "", e.paid_at ? fmtData(e.paid_at) : "", moeda(Number(e.amount))]),
        cards: [{ t: "Receitas", v: moeda(rec), cor: "#16a34a" }, { t: "Despesas", v: moeda(des), cor: "#dc2626" }, { t: "Saldo", v: moeda(rec - des), cor: "#2563eb" }],
      };
    },
  },
};

export function lerFiltros(sp: Record<string, string | undefined>): Filtros {
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  return { de: sp.de || hoje.slice(0, 8) + "01", ate: sp.ate || hoje, q: (sp.q ?? "").trim(), status: sp.status ?? "" };
}

// Quem não vê o financeiro não recebe relatórios de dinheiro nem colunas de valor.
export const SO_FINANCEIRO = ["compras", "vendas", "financeiro"];
export function semValores(r: Resultado): Resultado {
  const idx = r.cols.map((c, i) => (/^(valor|total)/i.test(c) ? i : -1)).filter((i) => i >= 0);
  return {
    cols: r.cols.filter((_, i) => !idx.includes(i)),
    rows: r.rows.map((l) => l.filter((_, i) => !idx.includes(i))),
    cards: r.cards.filter((c) => !/valor/i.test(c.t)),
  };
}
