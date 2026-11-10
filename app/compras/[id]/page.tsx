import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { fmtData, moeda } from "@/lib/format";
import { podeEditar } from "@/lib/permissoes";

const num = (v: FormDataEntryValue | null) => Number(String(v ?? "0").replace(/\./g, "").replace(",", ".")) || 0;
const nume = (v: FormDataEntryValue | null) => Number(String(v ?? "0").replace(",", ".")) || 0;
const volta = (id: string, extra = "") => `/compras/${id}${extra}`;

async function salvar(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const { error } = await supabase
    .from("purchases")
    .update({
      supplier_id: String(fd.get("supplier_id") || "") || null,
      purchased_at: String(fd.get("purchased_at") || "") ? new Date(String(fd.get("purchased_at")) + "-03:00").toISOString() : new Date().toISOString(),
      notes: String(fd.get("notes") || "").trim() || null,
      discount: nume(fd.get("discount")),
    })
    .eq("id", id);
  if (error) redirect(volta(id, "?erro=" + encodeURIComponent(error.message)));
  revalidatePath(volta(id));
  redirect(volta(id, "?ok=1"));
}

async function addItem(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const part_id = String(fd.get("part_id") || "");
  if (!part_id) redirect(volta(id, "?erro=" + encodeURIComponent("Escolha o produto.")));
  const { data: p } = await supabase.from("parts").select("name").eq("id", part_id).single();
  await supabase.from("purchase_items").insert({
    purchase_id: id,
    part_id,
    description: (p as any)?.name ?? "Produto",
    quantity: nume(fd.get("quantity")) || 1,
    unit_price: nume(fd.get("unit_price")),
    discount: nume(fd.get("discount")),
  });
  revalidatePath(volta(id));
  redirect(volta(id));
}

async function removerItem(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  await supabase.from("purchase_items").delete().eq("id", String(fd.get("item_id"))).eq("received_qty", 0);
  revalidatePath(volta(id));
  redirect(volta(id));
}

async function receber(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const item_id = String(fd.get("item_id"));
  const { data: it } = await supabase.from("purchase_items").select("part_id, quantity, received_qty").eq("id", item_id).single();
  const i: any = it;
  const falta = Number(i?.quantity ?? 0) - Number(i?.received_qty ?? 0);
  if (!i?.part_id || falta <= 0) redirect(volta(id));
  const { data: c } = await supabase.from("purchases").select("number").eq("id", id).single();
  await supabase.from("purchase_items").update({ received_qty: Number(i.quantity) }).eq("id", item_id);
  await supabase.from("stock_movements").insert({ part_id: i.part_id, quantity: falta, reason: "compra", notes: `Compra #${(c as any)?.number}` });
  revalidatePath(volta(id));
  redirect(volta(id));
}

async function estornar(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const item_id = String(fd.get("item_id"));
  const { data: it } = await supabase.from("purchase_items").select("part_id, received_qty").eq("id", item_id).single();
  const i: any = it;
  if (!i?.part_id || Number(i.received_qty) <= 0) redirect(volta(id));
  const { data: c } = await supabase.from("purchases").select("number").eq("id", id).single();
  await supabase.from("stock_movements").insert({ part_id: i.part_id, quantity: -Number(i.received_qty), reason: "estorno_compra", notes: `Estorno da compra #${(c as any)?.number}` });
  await supabase.from("purchase_items").update({ received_qty: 0 }).eq("id", item_id);
  revalidatePath(volta(id));
  redirect(volta(id));
}

async function addCusto(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const description = String(fd.get("description") || "").trim();
  if (description) await supabase.from("purchase_costs").insert({ purchase_id: id, description, amount: nume(fd.get("amount")) });
  revalidatePath(volta(id));
  redirect(volta(id));
}

async function removerCusto(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  await supabase.from("purchase_costs").delete().eq("id", String(fd.get("custo_id")));
  revalidatePath(volta(id));
  redirect(volta(id));
}

async function faturar(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const total = nume(fd.get("total"));
  const { data: c } = await supabase.from("purchases").select("number, supplier_id, suppliers(name), invoiced").eq("id", id).single();
  const p: any = c;
  if (p?.invoiced) redirect(volta(id));
  if (total <= 0) redirect(volta(id, "?erro=" + encodeURIComponent("Lance os itens antes de faturar.")));
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const { error } = await supabase.from("finance_entries").insert({
    kind: "despesa",
    category: "Compra de mercadoria",
    description: `Compra #${p.number}`,
    party: p.suppliers?.name ?? null,
    supplier_id: p.supplier_id,
    origin: "compra",
    amount: total,
    competence: hoje,
    due_date: hoje,
  });
  if (error) redirect(volta(id, "?erro=" + encodeURIComponent(error.message)));
  await supabase.from("purchases").update({ invoiced: true }).eq("id", id);
  revalidatePath(volta(id));
  redirect(volta(id, "?ok=1"));
}

async function excluir(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const { data: its } = await supabase.from("purchase_items").select("received_qty").eq("purchase_id", id);
  if ((its ?? []).some((i: any) => Number(i.received_qty) > 0)) redirect(volta(id, "?erro=" + encodeURIComponent("Estorne os itens recebidos antes de excluir.")));
  await supabase.from("purchases").delete().eq("id", id).eq("invoiced", false);
  redirect("/compras");
}

export default async function Compra({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { id } = await params;
  const { erro, ok } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const editar = podeEditar(perfil?.role, (perfil as any)?.permissions, "pecas");
  const { data: c } = await supabase.from("purchases").select("*, suppliers(name)").eq("id", id).maybeSingle();
  if (!c) notFound();
  const p: any = c;
  const [{ data: itens }, { data: custos }, { data: fornecedores }, { data: pecas }] = await Promise.all([
    supabase.from("purchase_items").select("*").eq("purchase_id", id).order("id"),
    supabase.from("purchase_costs").select("*").eq("purchase_id", id).order("id"),
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("parts").select("id, name, code").eq("active", true).order("name"),
  ]);
  const its: any[] = itens ?? [];
  const cts: any[] = custos ?? [];
  const subtotal = its.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price) - Number(i.discount), 0);
  const totalCustos = cts.reduce((s, x) => s + Number(x.amount), 0);
  const calculado = Math.max(subtotal + totalCustos - Number(p.discount), 0);
  const total = its.length ? calculado : Number(p.legacy_total ?? 0);
  const recebido = its.length > 0 && its.every((i) => Number(i.received_qty) >= Number(i.quantity));
  const temRecebido = its.some((i) => Number(i.received_qty) > 0);
  const dataLocal = new Date(p.purchased_at).toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 16).replace(" ", "T");

  return (
    <main className="wrap">
      {temRecebido && <div className="os-bloco" style={{ background: "#fef3c7", marginBottom: 12 }}>🔒 Esta compra possui itens recebidos. Os itens já recebidos ficam bloqueados — estorne o recebimento para alterá-los.</div>}
      {erro && <div className="error" style={{ marginBottom: 10 }}>{erro}</div>}
      {ok && <div className="os-ok">Salvo.</div>}
      <section className="card">
        <div className="headrow" style={{ marginBottom: 12 }}>
          <h1 className="title" style={{ margin: 0 }}>#Compra: {p.number}</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {its.length > 0 && <span className="badge" style={{ background: recebido ? "#dcfce7" : "#fef3c7" }}>{recebido ? "Recebido" : "Pendente"}</span>}
            <span className="badge">{p.invoiced ? "Faturado" : "Não faturado"}</span>
            <b style={{ color: "#2563eb" }}>{moeda(total)}</b>
          </div>
        </div>

        <form action={salvar} className="grid g2">
          <input type="hidden" name="id" value={p.id} />
          <label className="field">Fornecedor
            <select name="supplier_id" defaultValue={p.supplier_id ?? ""} disabled={!editar}>
              <option value="">—</option>
              {(fornecedores ?? []).map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          <label className="field">Data da compra
            <input type="datetime-local" name="purchased_at" defaultValue={dataLocal} disabled={!editar} />
          </label>
          <label className="field" style={{ gridColumn: "1/-1" }}>Observações
            <textarea name="notes" rows={2} defaultValue={p.notes ?? ""} disabled={!editar} placeholder="Observações sobre esta compra…" />
          </label>
          <label className="field">Desconto (R$)
            <input name="discount" inputMode="decimal" defaultValue={Number(p.discount)} disabled={!editar} />
          </label>
          {editar && <div style={{ alignSelf: "end" }}><button className="btn primary">Salvar</button></div>}
        </form>
      </section>

      <section className="card" style={{ marginTop: 14, overflowX: "auto" }}>
        <h2 style={{ marginTop: 0 }}>Produtos da Compra <span className="os-cont">{its.length} itens</span></h2>
        <table className="table">
          <thead><tr><th>Produto</th><th>Qtd</th><th>Recebido</th><th>Pendente</th><th>Preço unit.</th><th>Desc.</th><th>Subtotal</th><th>Ações</th></tr></thead>
          <tbody>
            {its.map((i) => {
              const pend = Number(i.quantity) - Number(i.received_qty);
              return (
                <tr key={i.id}>
                  <td>{i.description}</td>
                  <td>{Number(i.quantity)}</td>
                  <td><span className="badge" style={{ background: "#dcfce7" }}>{Number(i.received_qty)}</span></td>
                  <td><span className="badge" style={{ background: pend > 0 ? "#fef3c7" : "#dcfce7" }}>{pend}</span></td>
                  <td>{moeda(Number(i.unit_price))}</td>
                  <td>{Number(i.discount) ? moeda(Number(i.discount)) : "—"}</td>
                  <td>{moeda(Number(i.quantity) * Number(i.unit_price) - Number(i.discount))}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {editar && pend > 0 && (
                      <form action={receber} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={p.id} /><input type="hidden" name="item_id" value={i.id} />
                        <button className="btn primary" title="Receber no estoque">Receber</button>
                      </form>
                    )}{" "}
                    {editar && Number(i.received_qty) > 0 && (
                      <form action={estornar} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={p.id} /><input type="hidden" name="item_id" value={i.id} />
                        <button className="btn secondary" title="Estornar recebimento">Estornar</button>
                      </form>
                    )}{" "}
                    {editar && Number(i.received_qty) === 0 && (
                      <form action={removerItem} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={p.id} /><input type="hidden" name="item_id" value={i.id} />
                        <button className="btn secondary">Remover</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {!its.length && <tr><td colSpan={8} className="muted" style={{ textAlign: "center" }}>{p.legacy_total ? `Compra importada do Inforos (total ${moeda(Number(p.legacy_total))}); os itens não vieram na importação.` : "Nenhum produto adicionado."}</td></tr>}
          </tbody>
        </table>
        {editar && (
          <form action={addItem} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end", marginTop: 12 }}>
            <input type="hidden" name="id" value={p.id} />
            <label className="field" style={{ flex: 1, minWidth: 220 }}>Produto
              <select name="part_id" defaultValue="">
                <option value="">Escolha…</option>
                {(pecas ?? []).map((x: any) => <option key={x.id} value={x.id}>{x.name}{x.code ? ` (${x.code})` : ""}</option>)}
              </select>
            </label>
            <label className="field" style={{ width: 80 }}>Qtd<input name="quantity" defaultValue="1" inputMode="decimal" /></label>
            <label className="field" style={{ width: 110 }}>Preço unit.<input name="unit_price" defaultValue="0" inputMode="decimal" /></label>
            <label className="field" style={{ width: 100 }}>Desc. (R$)<input name="discount" defaultValue="0" inputMode="decimal" /></label>
            <button className="btn primary">+ Adicionar Produto</button>
          </form>
        )}
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h2 style={{ marginTop: 0 }}>Custos Adicionais <span className="muted" style={{ fontSize: 12 }}>(Frete, Montagem, Taxas, etc.)</span></h2>
        <table className="table">
          <tbody>
            {cts.map((x) => (
              <tr key={x.id}>
                <td>{x.description}</td><td style={{ width: 120 }}>{moeda(Number(x.amount))}</td>
                <td style={{ width: 90 }}>{editar && <form action={removerCusto}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="custo_id" value={x.id} /><button className="btn secondary">Remover</button></form>}</td>
              </tr>
            ))}
            {!cts.length && <tr><td className="muted" style={{ textAlign: "center" }}>Nenhum custo adicional adicionado.</td></tr>}
          </tbody>
        </table>
        {editar && (
          <form action={addCusto} style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <input type="hidden" name="id" value={p.id} />
            <input name="description" placeholder="Descrição (ex.: Frete)" style={{ flex: 1, minWidth: 180 }} />
            <input name="amount" placeholder="Valor" inputMode="decimal" style={{ width: 110 }} />
            <button className="btn primary">+ Adicionar Custo</button>
          </form>
        )}
      </section>

      <section className="card" style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div className="muted">Produtos <b>{moeda(subtotal)}</b> · Custos <b>{moeda(totalCustos)}</b> · Desconto <b>{moeda(Number(p.discount))}</b></div>
        <div style={{ fontSize: 22 }}>TOTAL <b>{moeda(total)}</b></div>
      </section>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, flexWrap: "wrap", gap: 8 }}>
        <Link className="btn secondary" href="/compras">← Voltar</Link>
        {editar && !p.invoiced && (
          <div style={{ display: "flex", gap: 8 }}>
            <form action={faturar}>
              <input type="hidden" name="id" value={p.id} /><input type="hidden" name="total" value={String(total)} />
              <button className="btn secondary">Faturar (gera a despesa)</button>
            </form>
            {!temRecebido && <form action={excluir}><input type="hidden" name="id" value={p.id} /><button className="btn secondary">Excluir</button></form>}
          </div>
        )}
      </div>
    </main>
  );
}
