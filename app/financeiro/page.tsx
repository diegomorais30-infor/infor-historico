import Link from "next/link";
import ConfigTabela from "@/components/config-tabela";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { fmtData, hojeBR, moeda } from "@/lib/format";
import { podeEditar, podeVer } from "@/lib/permissoes";

const FORMAS = ["Pix", "Dinheiro", "Débito", "Crédito", "Boleto", "Transferência"];
const CATEGORIAS = ["Ordem de Serviço", "Venda", "Contrato de locação", "Salário", "Aluguel", "Fornecedor", "Impostos", "Alimentação", "Combustível", "Outros"];
const NOMES_MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const BASES: Record<string, string> = { pagamento: "Data Pagamento", competencia: "Data Competência", vencimento: "Data Vencimento" };
const num = (v: FormDataEntryValue | null) => Number(String(v || "0").replace(/\./g, "").replace(",", ".")) || 0;
const txt = (v: FormDataEntryValue | null) => String(v || "").trim() || null;

type Params = { mes?: string; base?: string; situ?: string; tipo?: string; q?: string; cli?: string; desc?: string; forma?: string; cat?: string; novo?: string; editar?: string; erro?: string };

function url(p: Params, mudar: Params = {}) {
  const m: Record<string, string | undefined> = { ...p, ...mudar };
  const qs = Object.entries(m).filter(([k, v]) => v && k !== "erro" && !(k === "base" && v === "pagamento") && !(k === "situ" && v === "todas")).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
  return "/financeiro" + (qs ? `?${qs}` : "");
}

async function salvar(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const volta = String(formData.get("volta") || "/financeiro");
  const sep = volta.includes("?") ? "&" : "?";
  const kind = String(formData.get("kind")) === "despesa" ? "despesa" : "receita";
  const id = txt(formData.get("id"));
  const descricao = txt(formData.get("description"));
  const bruto = num(formData.get("gross"));
  if (!descricao || bruto <= 0) redirect(volta + sep + "erro=" + encodeURIComponent("Informe a descrição e um valor maior que zero."));
  const desconto = num(formData.get("discount"));
  const juros = num(formData.get("interest"));
  const due = String(formData.get("due_date") || hojeBR());
  const pago = formData.get("pago") === "on";
  const dados = {
    kind,
    description: descricao,
    category: txt(formData.get("category")),
    party: txt(formData.get("party")),
    gross: bruto,
    discount: desconto,
    interest: juros,
    fees: num(formData.get("fees")),
    amount: Math.max(bruto - desconto + juros, 0),
    payment_method: txt(formData.get("payment_method")),
    competence: String(formData.get("competence") || due),
    due_date: due,
    paid_at: pago ? String(formData.get("paid_at") || due) : null,
    notes: txt(formData.get("notes")),
  };
  const { error } = id ? await supabase.from("finance_entries").update(dados).eq("id", id) : await supabase.from("finance_entries").insert(dados);
  if (error) redirect(volta + sep + "erro=" + encodeURIComponent(error.message));
  revalidatePath("/financeiro");
  redirect(volta.replace(/[?&](novo|editar)=[^&]*/g, "").replace("/financeiro&", "/financeiro?"));
}

async function alternarPago(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const desfazer = formData.get("desfazer") === "1";
  await supabase.from("finance_entries").update({ paid_at: desfazer ? null : hojeBR() }).eq("id", String(formData.get("id")));
  revalidatePath("/financeiro");
  redirect(String(formData.get("volta") || "/financeiro"));
}

async function excluir(formData: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("finance_entries").delete().eq("id", String(formData.get("id")));
  revalidatePath("/financeiro");
  redirect(String(formData.get("volta") || "/financeiro"));
}

function mesVizinho(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function Faturas({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { supabase, perfil } = await getContexto();
  const perms = (perfil as any)?.permissions;
  if (!podeVer(perfil?.role, perms, "financeiro")) redirect("/dashboard");
  const editar = podeEditar(perfil?.role, perms, "financeiro");
  const gerente = perfil?.role === "admin" || perfil?.role === "manager";

  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : hojeBR().slice(0, 7);
  const base = sp.base === "competencia" || sp.base === "vencimento" ? sp.base : "pagamento";
  const situ = sp.situ === "pagos" || sp.situ === "pendentes" ? sp.situ : "todas";
  const tipo = sp.tipo === "receita" || sp.tipo === "despesa" ? sp.tipo : "";
  const ini = `${mes}-01`;
  const fim = `${mesVizinho(mes, 1)}-01`;
  const atual: Params = { ...sp, mes };
  const volta = url(atual);

  let q = supabase.from("finance_entries").select("*").limit(2000);
  if (base === "pagamento") q = q.or(`and(paid_at.gte.${ini},paid_at.lt.${fim}),and(paid_at.is.null,due_date.gte.${ini},due_date.lt.${fim})`);
  else if (base === "competencia") q = q.gte("competence", ini).lt("competence", fim);
  else q = q.gte("due_date", ini).lt("due_date", fim);
  const { data } = await q.order("created_at", { ascending: false });
  const periodo: any[] = data ?? [];

  const soma = (k: string, f: (e: any) => boolean = () => true) => periodo.filter((e) => e.kind === k && f(e)).reduce((t, e) => t + Number(e.amount), 0);
  const recTotal = soma("receita");
  const recPago = soma("receita", (e) => !!e.paid_at);
  const despTotal = soma("despesa");
  const despPago = soma("despesa", (e) => !!e.paid_at);
  const extras = periodo.reduce((t, e) => t + Number(e.interest ?? 0) + Number(e.fees ?? 0), 0);
  const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);

  const termo = (sp.q ?? "").trim().toLowerCase();
  const inc = (v: any, t?: string) => !t || String(v ?? "").toLowerCase().includes(t.toLowerCase());
  const lista = periodo
    .filter((e) => (!tipo || e.kind === tipo) && (situ === "todas" || (situ === "pagos" ? !!e.paid_at : !e.paid_at)))
    .filter((e) => !termo || [e.description, e.party, e.category, e.legacy_ref, e.notes].some((t) => inc(t, termo)))
    .filter((e) => inc(e.party, sp.cli) && inc(e.description, sp.desc) && inc(e.payment_method, sp.forma) && (!sp.cat || e.category === sp.cat))
    .sort((a, b) => Number(b.legacy_ref ?? 1e9) - Number(a.legacy_ref ?? 1e9) || (a.created_at < b.created_at ? 1 : -1));

  const osIds = [...new Set(lista.map((e) => e.order_id).filter(Boolean))];
  const vdIds = [...new Set(lista.map((e) => e.sale_id).filter(Boolean))];
  const [{ data: oss }, { data: vds }, { data: cats }] = await Promise.all([
    osIds.length ? supabase.from("service_orders").select("id, number").in("id", osIds) : Promise.resolve({ data: [] as any[] }),
    vdIds.length ? supabase.from("sales").select("id, number").in("id", vdIds) : Promise.resolve({ data: [] as any[] }),
    supabase.from("finance_entries").select("category").not("category", "is", null).limit(3000),
  ]);
  const nOS = new Map((oss ?? []).map((o: any) => [o.id, o.number]));
  const nVD = new Map((vds ?? []).map((o: any) => [o.id, o.number]));
  const categorias = [...new Set([...CATEGORIAS, ...(cats ?? []).map((c: any) => c.category)])].sort();

  const formKind = sp.novo === "despesa" ? "despesa" : sp.novo === "receita" ? "receita" : "";
  const emEdicao = sp.editar ? periodo.find((e) => e.id === sp.editar) ?? (await supabase.from("finance_entries").select("*").eq("id", sp.editar).maybeSingle()).data : null;
  const [ano, m] = mes.split("-").map(Number);
  const temFiltro = !!(sp.cli || sp.desc || sp.forma || sp.cat);

  const Cartao = ({ titulo, cor, valor, sub, pago, total, rotuloPago, faltam }: any) => (
    <div className="card fat-card">
      <div className="fat-t"><span className="dot" style={{ background: cor }} /> {titulo}</div>
      <div className="fat-v">{moeda(valor)}</div>
      <div className="muted fat-s">{sub}</div>
      <div className="bar"><i style={{ width: `${pct(pago, total)}%`, background: cor }} /></div>
      <div className="fat-f"><span><b>{pct(pago, total)}%</b> {rotuloPago}</span><span>Faltam <b>{moeda(faltam)}</b></span></div>
    </div>
  );

  const Form = ({ kind, e }: { kind: string; e?: any }) => (
    <section className="card" style={{ marginBottom: 14 }}>
      <h2>{e ? "Editar" : "Adicionar"} {kind === "receita" ? "receita" : "despesa"}</h2>
      <form action={salvar} className="grid g4" style={{ marginTop: 10 }}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={e?.id ?? ""} />
        <input type="hidden" name="volta" value={volta} />
        <label className="field">{kind === "receita" ? "Cliente" : "Fornecedor"}<input name="party" defaultValue={e?.party ?? ""} /></label>
        <label className="field">Descrição<input name="description" required defaultValue={e?.description ?? ""} /></label>
        <label className="field">Categoria<input name="category" list="cats" defaultValue={e?.category ?? ""} /><datalist id="cats">{categorias.map((c) => <option key={c} value={c} />)}</datalist></label>
        <label className="field">Data competência<input name="competence" type="date" defaultValue={e?.competence ?? hojeBR()} /></label>
        <label className="field">Valor bruto (R$)<input name="gross" inputMode="decimal" required defaultValue={e ? String(e.gross ?? e.amount).replace(".", ",") : ""} /></label>
        <label className="field">(−) Desconto<input name="discount" inputMode="decimal" defaultValue={e && Number(e.discount) ? String(e.discount).replace(".", ",") : ""} /></label>
        <label className="field">(+) Juros<input name="interest" inputMode="decimal" defaultValue={e && Number(e.interest) ? String(e.interest).replace(".", ",") : ""} /></label>
        <label className="field">(+) Taxas<input name="fees" inputMode="decimal" defaultValue={e && Number(e.fees) ? String(e.fees).replace(".", ",") : ""} /></label>
        <label className="field">Data vencimento<input name="due_date" type="date" defaultValue={e?.due_date ?? hojeBR()} /></label>
        <label className="field">Forma de pagamento<input name="payment_method" list="formas2" defaultValue={e?.payment_method ?? ""} /><datalist id="formas2">{FORMAS.map((c) => <option key={c} value={c} />)}</datalist></label>
        <label className="field">Data do pagamento<input name="paid_at" type="date" defaultValue={e?.paid_at ?? ""} /></label>
        <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input name="pago" type="checkbox" defaultChecked={!!e?.paid_at} style={{ width: "auto" }} /> Pago / recebido</label>
        <label className="field" style={{ gridColumn: "1/-1" }}>Anotações<input name="notes" defaultValue={e?.notes ?? ""} /></label>
        <div style={{ gridColumn: "1/-1", display: "flex", gap: 8 }}>
          <button className="btn primary">{e ? "Salvar" : "Faturar"}</button>
          <Link className="btn secondary" href={url(atual, { novo: undefined, editar: undefined })}>Voltar</Link>
        </div>
      </form>
    </section>
  );

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="title">Faturas</h1>
          <div className="muted">Receitas e despesas do período</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <form style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {Object.entries({ ...atual, base: undefined }).filter(([k, v]) => v && k !== "erro" && k !== "mes").map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v)} />)}
            <select name="base" defaultValue={base} className="auto-sub">
              {Object.entries(BASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="month" name="mes" defaultValue={mes} />
            <button className="btn secondary">Aplicar</button>
          </form>
          <Link className="btn secondary" href={url(atual, { mes: mesVizinho(mes, -1) })}>←</Link>
          <b style={{ minWidth: 110, textAlign: "center" }}>{NOMES_MES[m - 1]} {ano}</b>
          <Link className="btn secondary" href={url(atual, { mes: mesVizinho(mes, 1) })}>→</Link>
          {editar && (
            <details className="menu-novo">
              <summary className="btn primary">+ Novo lançamento ▾</summary>
              <div className="menu-pop">
                <Link href={url(atual, { novo: "receita", editar: undefined })}><b>Receita</b><br /><span className="muted">Dinheiro que entra</span></Link>
                <Link href={url(atual, { novo: "despesa", editar: undefined })}><b>Despesa</b><br /><span className="muted">Dinheiro que sai</span></Link>
              </div>
            </details>
          )}
        </div>
      </div>

      {sp.erro && <div className="error" style={{ marginBottom: 12 }}>{sp.erro}</div>}

      <div className="grid g3" style={{ marginBottom: 14 }}>
        <Cartao titulo="RECEBIMENTOS" cor="#16a36a" valor={recTotal} sub={`${moeda(recPago)} já recebidos`} pago={recPago} total={recTotal} rotuloPago="recebido" faltam={recTotal - recPago} />
        <Cartao titulo="DESPESAS" cor="#e5484d" valor={despTotal} sub={`${moeda(despPago)} já pagos`} pago={despPago} total={despTotal} rotuloPago="pago" faltam={despTotal - despPago} />
        <div className="card fat-card" style={{ borderLeft: "3px solid #16a36a" }}>
          <div className="fat-t">SALDO PREVISTO</div>
          <div className="fat-v" style={{ color: recTotal - despTotal >= 0 ? "#16a36a" : "#e5484d" }}>{moeda(recTotal - despTotal)}</div>
          <div className="muted fat-s">Realizado: {moeda(recPago - despPago)}</div>
          <div className="fat-f" style={{ marginTop: 22 }}><span className="muted">Juros, taxas e impostos</span><b>{moeda(extras)}</b></div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div className="seg">
          <Link className={situ === "todas" ? "on" : ""} href={url(atual, { situ: undefined })}>Todas</Link>
          <Link className={situ === "pagos" ? "on" : ""} href={url(atual, { situ: "pagos" })}>Pagos</Link>
          <Link className={situ === "pendentes" ? "on" : ""} href={url(atual, { situ: "pendentes" })}>Pendentes</Link>
        </div>
        <div className="seg">
          <Link className={!tipo ? "on" : ""} href={url(atual, { tipo: undefined })}>Todos</Link>
          <Link className={tipo === "receita" ? "on" : ""} href={url(atual, { tipo: "receita" })}>● Recebimentos</Link>
          <Link className={tipo === "despesa" ? "on" : ""} href={url(atual, { tipo: "despesa" })}>● Despesas</Link>
        </div>
        <form style={{ display: "flex", gap: 8, flex: 1, minWidth: 220, justifyContent: "flex-end" }}>
          {Object.entries({ ...atual, q: undefined }).filter(([k, v]) => v && k !== "erro").map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v)} />)}
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar (descrição, cliente, nº)" style={{ maxWidth: 320, flex: 1 }} />
          <button className="btn secondary">Buscar</button>
        </form>
      </div>

      <details className="card" style={{ marginBottom: 14 }} open={temFiltro}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Filtros avançados{temFiltro ? " (ativos)" : ""}</summary>
        <form className="grid g4" style={{ marginTop: 10 }}>
          {Object.entries({ mes, base, situ, tipo, q: sp.q }).filter(([, v]) => v).map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v)} />)}
          <label className="field">Cliente / Fornecedor<input name="cli" defaultValue={sp.cli ?? ""} /></label>
          <label className="field">Descrição<input name="desc" defaultValue={sp.desc ?? ""} /></label>
          <label className="field">Forma de pagamento<select name="forma" defaultValue={sp.forma ?? ""}><option value="">Todas</option>{FORMAS.map((f) => <option key={f}>{f}</option>)}<option value="boleto">boleto</option><option value="pix">pix</option></select></label>
          <label className="field">Categoria<select name="cat" defaultValue={sp.cat ?? ""}><option value="">Todas</option>{categorias.map((c) => <option key={c}>{c}</option>)}</select></label>
          <div style={{ gridColumn: "1/-1", display: "flex", gap: 8 }}>
            <button className="btn primary">Aplicar</button>
            <Link className="btn secondary" href={url({ mes, base, situ, tipo, q: sp.q })}>Limpar</Link>
          </div>
        </form>
      </details>

      {editar && formKind && !emEdicao && <Form kind={formKind} />}
      {editar && emEdicao && <Form kind={emEdicao.kind} e={emEdicao} />}

      <section className="card">
        <div className="headrow" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Faturas</h2>
          <span className="muted"><b>{lista.length}</b> lançamentos</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <ConfigTabela chave="faturas" />
<table className="table">
            <thead>
              <tr>
                <th>#</th><th>Lançamento</th><th>Categoria</th><th>Cliente / fornecedor</th><th>Forma pgto</th>
                <th style={{ textAlign: "right" }}>Bruto</th><th style={{ textAlign: "right" }}>Desconto</th><th style={{ textAlign: "right" }}>Juros</th><th style={{ textAlign: "right" }}>Taxas</th><th style={{ textAlign: "right" }}>Valor</th>
                <th>Competência</th><th>Data</th><th>Pago</th>{editar && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {lista.map((e) => {
                const rec = e.kind === "receita";
                const tc = e.legacy_data?.tipo_categoria ?? (rec ? "Recebimentos" : "Despesas");
                const vinculo = e.order_id
                  ? { href: `/os/${e.order_id}`, rot: `OS #${nOS.get(e.order_id) ?? ""}` }
                  : e.sale_id
                    ? { href: `/vendas/${e.sale_id}`, rot: `VENDA #${nVD.get(e.sale_id) ?? ""}` }
                    : null;
                return (
                  <tr key={e.id}>
                    <td className="muted">{e.legacy_ref ?? "—"}</td>
                    <td>
                      <span className={rec ? "tag-r" : "tag-d"}>{tc}</span>
                      {vinculo && <div><Link className="chip-link" href={vinculo.href}>👁 {vinculo.rot}</Link></div>}
                    </td>
                    <td>{e.category ?? "—"}</td>
                    <td><b>{e.legacy_data?.nome_cliente_fornecedor?.trim() || e.party || "—"}</b><div className="muted" style={{ fontSize: 12 }}>{e.description}</div></td>
                    <td>{e.payment_method ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{moeda(e.gross ?? e.amount)}</td>
                    <td style={{ textAlign: "right" }}>{moeda(e.discount ?? 0)}</td>
                    <td style={{ textAlign: "right" }}>{moeda(e.interest ?? 0)}</td>
                    <td style={{ textAlign: "right" }}>{moeda(e.fees ?? 0)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: rec ? "#16a36a" : "#e5484d" }}>{rec ? "" : "−"}{moeda(e.amount)}</td>
                    <td>{fmtData(e.competence)}</td>
                    <td>{fmtData(e.paid_at ?? e.due_date)}</td>
                    <td>
                      {editar ? (
                        <form action={alternarPago}>
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="volta" value={volta} />
                          {e.paid_at && <input type="hidden" name="desfazer" value="1" />}
                          <button className={`sw ${e.paid_at ? "on" : ""}`} title={e.paid_at ? "Marcar como pendente" : rec ? "Marcar como recebido" : "Marcar como pago"} aria-label="Alternar pago"><i /></button>
                        </form>
                      ) : (
                        <span className={e.paid_at ? "badge" : "badge warn"}>{e.paid_at ? "Pago" : "Pendente"}</span>
                      )}
                    </td>
                    {editar && (
                      <td>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <Link className="btn secondary" href={url(atual, { editar: e.id, novo: undefined })}>✏️</Link>
                          {gerente && !e.order_id && !e.sale_id && (
                            <form action={excluir}>
                              <input type="hidden" name="id" value={e.id} />
                              <input type="hidden" name="volta" value={volta} />
                              <button className="btn secondary" title="Excluir">🗑</button>
                            </form>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!lista.length && (
                <tr><td colSpan={14} className="muted">Nenhum lançamento neste período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10 }}><Link className="btn secondary" href="/financeiro/fluxo">Fluxo de caixa</Link></div>
      </section>
    </main>
  );
}
