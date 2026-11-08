import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { fmtData, hojeBR, moeda } from "@/lib/format";
import { podeEditar, podeVer } from "@/lib/permissoes";

const FORMAS = ["Pix", "Dinheiro", "Débito", "Crédito", "Boleto", "Transferência"];
const CATEGORIAS = ["Ordem de Serviço", "Venda", "Contrato de locação", "Salário", "Aluguel", "Fornecedor", "Impostos", "Alimentação", "Combustível", "Outros"];
const num = (v: FormDataEntryValue | null) => Number(String(v || "0").replace(",", ".")) || 0;
const voltar = (mes: string, extra = "") => `/financeiro?mes=${mes}${extra}`;

async function lancar(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const mes = String(formData.get("mes"));
  const descricao = String(formData.get("description") || "").trim();
  if (!descricao || num(formData.get("amount")) <= 0) redirect(voltar(mes, "&erro=" + encodeURIComponent("Informe a descrição e um valor maior que zero.")));
  const due = String(formData.get("due_date") || hojeBR());
  const pago = formData.get("pago") === "on";
  const { error } = await supabase.from("finance_entries").insert({
    kind: String(formData.get("kind")) === "despesa" ? "despesa" : "receita",
    description: descricao,
    category: String(formData.get("category") || "").trim() || null,
    party: String(formData.get("party") || "").trim() || null,
    amount: num(formData.get("amount")),
    payment_method: String(formData.get("payment_method") || "").trim() || null,
    competence: due,
    due_date: due,
    paid_at: pago ? due : null,
  });
  if (error) redirect(voltar(mes, "&erro=" + encodeURIComponent(error.message)));
  revalidatePath("/financeiro");
  redirect(voltar(mes));
}

async function marcarPago(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const mes = String(formData.get("mes"));
  const desfazer = formData.get("desfazer") === "1";
  await supabase
    .from("finance_entries")
    .update({ paid_at: desfazer ? null : hojeBR() })
    .eq("id", String(formData.get("id")));
  revalidatePath("/financeiro");
  redirect(voltar(mes, String(formData.get("extra") || "")));
}

async function excluir(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const mes = String(formData.get("mes"));
  await supabase.from("finance_entries").delete().eq("id", String(formData.get("id")));
  revalidatePath("/financeiro");
  redirect(voltar(mes));
}

function mesVizinho(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export default async function Financeiro({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; tipo?: string; q?: string; erro?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, perfil } = await getContexto();
  const perms = (perfil as any)?.permissions;
  if (!podeVer(perfil?.role, perms, "financeiro")) redirect("/dashboard");
  const editar = podeEditar(perfil?.role, perms, "financeiro");
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : hojeBR().slice(0, 7);
  const tipo = sp.tipo === "receita" || sp.tipo === "despesa" ? sp.tipo : "";
  const termo = (sp.q ?? "").trim().toLowerCase();
  const ini = `${mes}-01`;
  const fim = `${mesVizinho(mes, 1)}-01`;

  const { data } = await supabase
    .from("finance_entries")
    .select("*")
    .gte("due_date", ini)
    .lt("due_date", fim)
    .order("due_date", { ascending: false })
    .order("created_at", { ascending: false });
  const todos: any[] = data ?? [];

  const soma = (k: string, f: (e: any) => boolean) => todos.filter((e) => e.kind === k && f(e)).reduce((t, e) => t + Number(e.amount), 0);
  const recebido = soma("receita", (e) => !!e.paid_at);
  const recPend = soma("receita", (e) => !e.paid_at);
  const pago = soma("despesa", (e) => !!e.paid_at);
  const despPend = soma("despesa", (e) => !e.paid_at);
  const margemReal = recebido - pago;
  const margemPrev = recebido + recPend - (pago + despPend);

  const lista = todos.filter(
    (e) =>
      (!tipo || e.kind === tipo) &&
      (!termo || [e.description, e.party, e.category].filter(Boolean).some((t: string) => t.toLowerCase().includes(termo)))
  );
  const [ano, m] = mes.split("-").map(Number);
  const hoje = hojeBR();
  const extra = (tipo ? `&tipo=${tipo}` : "") + (sp.q ? `&q=${encodeURIComponent(sp.q)}` : "");

  const Cartao = ({ titulo, cor, a, b, c }: { titulo: string; cor: string; a: string; b: string; c: string }) => (
    <div className="card" style={{ borderTop: `3px solid ${cor}` }}>
      <div className="muted">{titulo}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: cor }}>{a}</div>
      <div className="muted" style={{ fontSize: 13 }}>
        Pendente: {b} · Previsto: {c}
      </div>
    </div>
  );

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 12 }}>
        <h1 className="title">Financeiro</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn secondary" href="/financeiro/fluxo">Fluxo de caixa</Link>
        </div>
      </div>

      <div className="grid g3" style={{ marginBottom: 14 }}>
        <Cartao titulo="Recebimentos (recebido)" cor="#3fb583" a={moeda(recebido)} b={moeda(recPend)} c={moeda(recebido + recPend)} />
        <Cartao titulo="Despesas (pago)" cor="#e5484d" a={moeda(pago)} b={moeda(despPend)} c={moeda(pago + despPend)} />
        <Cartao titulo="Margem (realizada)" cor="#2f7de1" a={moeda(margemReal)} b={moeda(margemPrev - margemReal)} c={moeda(margemPrev)} />
      </div>

      {sp.erro && <div className="error" style={{ marginBottom: 12 }}>{sp.erro}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <Link className="btn secondary" href={`/financeiro?mes=${mesVizinho(mes, -1)}${extra}`}>←</Link>
        <b style={{ minWidth: 150, textAlign: "center", textTransform: "capitalize" }}>
          {NOMES_MES[m - 1]} de {ano}
        </b>
        <Link className="btn secondary" href={`/financeiro?mes=${mesVizinho(mes, 1)}${extra}`}>→</Link>
        <Link className={!tipo ? "btn primary" : "btn secondary"} href={`/financeiro?mes=${mes}`}>Todos</Link>
        <Link className={tipo === "receita" ? "btn primary" : "btn secondary"} href={`/financeiro?mes=${mes}&tipo=receita`}>Recebimentos</Link>
        <Link className={tipo === "despesa" ? "btn primary" : "btn secondary"} href={`/financeiro?mes=${mes}&tipo=despesa`}>Despesas</Link>
        <form style={{ display: "flex", gap: 8, flex: 1, minWidth: 220 }}>
          <input type="hidden" name="mes" value={mes} />
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar descrição, cliente ou categoria" style={{ flex: 1 }} />
          <button className="btn secondary">Buscar</button>
        </form>
      </div>

      {editar && (
        <details className="card" style={{ marginBottom: 14 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>+ Nova receita / despesa</summary>
          <form action={lancar} className="grid g4" style={{ marginTop: 12 }}>
            <input type="hidden" name="mes" value={mes} />
            <label className="field">
              Tipo
              <select name="kind" defaultValue="receita">
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
              </select>
            </label>
            <label className="field">
              Descrição
              <input name="description" required />
            </label>
            <label className="field">
              Cliente / fornecedor
              <input name="party" />
            </label>
            <label className="field">
              Categoria
              <input name="category" list="cats" />
              <datalist id="cats">{CATEGORIAS.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="field">
              Valor (R$)
              <input name="amount" inputMode="decimal" required />
            </label>
            <label className="field">
              Vencimento
              <input name="due_date" type="date" defaultValue={hoje} />
            </label>
            <label className="field">
              Forma de pagamento
              <input name="payment_method" list="formas2" />
              <datalist id="formas2">{FORMAS.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input name="pago" type="checkbox" style={{ width: "auto" }} /> Já foi pago/recebido
            </label>
            <div style={{ gridColumn: "1/-1" }}>
              <button className="btn primary">Lançar</button>
            </div>
          </form>
        </details>
      )}

      <section className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Lançamento</th>
              <th>Categoria</th>
              <th>Cliente / fornecedor</th>
              <th>Forma</th>
              <th>Valor</th>
              <th>Vencimento</th>
              <th>Situação</th>
              {editar && <th></th>}
            </tr>
          </thead>
          <tbody>
            {lista.map((e) => {
              const atrasado = !e.paid_at && e.due_date < hoje;
              return (
                <tr key={e.id}>
                  <td>
                    {e.order_id ? (
                      <Link href={`/os/${e.order_id}`} style={{ color: "var(--link)" }}>{e.description}</Link>
                    ) : (
                      e.description
                    )}
                  </td>
                  <td>{e.category ?? "—"}</td>
                  <td>{e.party ?? "—"}</td>
                  <td>{e.payment_method ?? "—"}</td>
                  <td style={{ color: e.kind === "receita" ? "#3fb583" : "#e5484d", fontWeight: 700 }}>
                    {e.kind === "despesa" ? "−" : ""}{moeda(e.amount)}
                  </td>
                  <td>{fmtData(e.due_date)}</td>
                  <td>
                    {e.paid_at ? (
                      <span className="badge">{e.kind === "receita" ? "Recebido" : "Pago"} {fmtData(e.paid_at)}</span>
                    ) : (
                      <span className="badge warn">{atrasado ? "Atrasado" : "Pendente"}</span>
                    )}
                  </td>
                  {editar && (
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <form action={marcarPago}>
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="mes" value={mes} />
                          <input type="hidden" name="extra" value={extra} />
                          {e.paid_at && <input type="hidden" name="desfazer" value="1" />}
                          <button className="btn secondary">{e.paid_at ? "Desfazer" : e.kind === "receita" ? "Receber" : "Pagar"}</button>
                        </form>
                        {!e.order_id && (
                          <form action={excluir}>
                            <input type="hidden" name="id" value={e.id} />
                            <input type="hidden" name="mes" value={mes} />
                            <button className="btn secondary">Excluir</button>
                          </form>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {!lista.length && (
              <tr>
                <td colSpan={8} className="muted">Nenhum lançamento neste mês.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
