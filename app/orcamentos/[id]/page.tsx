import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { hojeBR, moeda } from "@/lib/format";
import { podeEditar } from "@/lib/permissoes";
import { lerConfig, preencher, saudacao } from "@/lib/config";

const nume = (v: FormDataEntryValue | null) => Number(String(v ?? "0").replace(",", ".")) || 0;
const volta = (id: string, extra = "") => `/orcamentos/${id}${extra}`;
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://inforgest.com.br";

async function salvar(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const v = String(fd.get("valid_until") || "");
  const { error } = await supabase
    .from("quotes")
    .update({
      client_id: String(fd.get("client_id") || "") || null,
      report: String(fd.get("report") || "").trim() || null,
      notes: String(fd.get("notes") || "").trim() || null,
      terms: String(fd.get("terms") || "").trim() || null,
      title: String(fd.get("title") || "").trim() || null,
      valid_until: v ? new Date(v + "-03:00").toISOString() : null,
    })
    .eq("id", id);
  if (error) redirect(volta(id, "?erro=" + encodeURIComponent(error.message)));
  revalidatePath(volta(id));
  redirect(volta(id, "?ok=1"));
}

async function status(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  await supabase.from("quotes").update({ status: String(fd.get("status")) }).eq("id", id);
  revalidatePath(volta(id));
  redirect(volta(id));
}

async function salvarOpcao(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  await supabase
    .from("quote_options")
    .update({ name: String(fd.get("name") || "").trim() || "Opção", description: String(fd.get("description") || "").trim() || null, payment_forms: String(fd.get("payment_forms") || "").trim() || null })
    .eq("id", String(fd.get("option_id")));
  revalidatePath(volta(id));
  redirect(volta(id, "?ok=1"));
}

async function novaOpcao(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const { data } = await supabase.from("quote_options").select("position").eq("quote_id", id).order("position", { ascending: false }).limit(1);
  const pos = Number((data as any)?.[0]?.position ?? 0) + 1;
  await supabase.from("quote_options").insert({ quote_id: id, position: pos, name: `Opção ${pos}` });
  revalidatePath(volta(id));
  redirect(volta(id));
}

async function removerOpcao(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const { count } = await supabase.from("quote_options").select("id", { count: "exact", head: true }).eq("quote_id", id);
  if ((count ?? 0) > 1) await supabase.from("quote_options").delete().eq("id", String(fd.get("option_id")));
  revalidatePath(volta(id));
  redirect(volta(id));
}

async function addItem(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const kind = String(fd.get("kind") || "avulso");
  const catalogo = String(fd.get("catalogo") || "");
  let description = String(fd.get("description") || "").trim();
  if (!description && catalogo) {
    const { data } = kind === "produto" ? await supabase.from("parts").select("name").eq("id", catalogo).single() : await supabase.from("catalog_services").select("name").eq("id", catalogo).single();
    description = (data as any)?.name ?? "";
  }
  if (!description) redirect(volta(id, "?erro=" + encodeURIComponent("Descreva o item ou escolha do cadastro.")));
  await supabase.from("quote_items").insert({
    option_id: String(fd.get("option_id")),
    kind,
    description,
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
  await supabase.from("quote_items").delete().eq("id", String(fd.get("item_id")));
  revalidatePath(volta(id));
  redirect(volta(id));
}

async function converterOS(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const { data: q } = await supabase.from("quotes").select("*, quote_options(id, position, quote_items(kind, description, quantity, unit_price, discount))").eq("id", id).single();
  const o: any = q;
  if (!o?.client_id) redirect(volta(id, "?erro=" + encodeURIComponent("Escolha o cliente antes de converter.")));
  if (o.converted_os_id) redirect(`/os/${o.converted_os_id}`);
  const ops = [...(o.quote_options ?? [])].sort((a: any, b: any) => a.position - b.position);
  const op = ops.find((x: any) => x.id === o.chosen_option) ?? ops[0];
  const { data: os, error } = await supabase
    .from("service_orders")
    .insert({ client_id: o.client_id, defect: o.report || o.title || null, quote_text: o.notes || null, priority: "normal" })
    .select("id")
    .single();
  if (error || !os) redirect(volta(id, "?erro=" + encodeURIComponent(error?.message ?? "Não foi possível criar a OS.")));
  const osId = (os as any).id;
  for (const i of op?.quote_items ?? []) {
    const { data: it } = await supabase
      .from("service_order_items")
      .insert({ order_id: osId, kind: i.kind === "produto" ? "peca" : "servico", description: i.description, quantity: Number(i.quantity) })
      .select("id")
      .single();
    const unit = Math.max(Number(i.unit_price) - Number(i.discount) / (Number(i.quantity) || 1), 0);
    if (it) await supabase.from("item_prices").upsert({ item_id: (it as any).id, unit_price: unit }, { onConflict: "item_id" });
  }
  await supabase.from("quotes").update({ converted_os_id: osId, status: "convertido" }).eq("id", id);
  redirect(`/os/${osId}?aba=itens`);
}

async function converterVenda(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const { data: q } = await supabase.from("quotes").select("*, quote_options(id, position, quote_items(kind, description, quantity, unit_price, discount))").eq("id", id).single();
  const o: any = q;
  if (!o?.client_id) redirect(volta(id, "?erro=" + encodeURIComponent("Escolha o cliente antes de converter.")));
  if (o.converted_sale_id) redirect(`/vendas/${o.converted_sale_id}`);
  const ops = [...(o.quote_options ?? [])].sort((a: any, b: any) => a.position - b.position);
  const op = ops.find((x: any) => x.id === o.chosen_option) ?? ops[0];
  const { data: ult } = await supabase.from("sales").select("number").order("number", { ascending: false }).limit(1);
  const number = Number((ult as any)?.[0]?.number ?? 0) + 1;
  let seller: string | null = null;
  if (o.seller_id) {
    const { data: pf } = await supabase.from("profiles").select("full_name").eq("id", o.seller_id).maybeSingle();
    seller = (pf as any)?.full_name ?? null;
  }
  const itens: any[] = op?.quote_items ?? [];
  const total = itens.reduce((t, i) => t + Number(i.quantity) * Number(i.unit_price) - Number(i.discount), 0);
  const { data: v, error } = await supabase
    .from("sales")
    .insert({ number, client_id: o.client_id, sold_at: hojeBR(), seller, notes: `Orçamento Express #${o.number}`, total: Math.max(total, 0) })
    .select("id")
    .single();
  if (error || !v) redirect(volta(id, "?erro=" + encodeURIComponent(error?.message ?? "Não foi possível criar a venda.")));
  const vid = (v as any).id;
  if (itens.length)
    await supabase.from("sale_items").insert(
      itens.map((i) => ({ sale_id: vid, kind: i.kind === "servico" ? "servico" : "produto", description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price), discount: Number(i.discount) }))
    );
  await supabase.from("quotes").update({ converted_sale_id: vid, status: "convertido" }).eq("id", id);
  redirect(`/vendas/${vid}`);
}

async function excluir(fd: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("quotes").delete().eq("id", String(fd.get("id")));
  redirect("/orcamentos");
}

export default async function Orcamento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { id } = await params;
  const { erro, ok } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const editar = podeEditar(perfil?.role, (perfil as any)?.permissions, "os");
  const { data } = await supabase.from("quotes").select("*, clients(name, phone, mobile, email)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const q: any = data;
  const [{ data: ops }, { data: itens }, { data: clientes }, { data: termos }, { data: pecas }, { data: servicos }] = await Promise.all([
    supabase.from("quote_options").select("*").eq("quote_id", id).order("position"),
    supabase.from("quote_items").select("*, quote_options!inner(quote_id)").eq("quote_options.quote_id", id).order("id"),
    supabase.from("clients").select("id, name").eq("active", true).order("name").limit(2000),
    supabase.from("warranty_terms").select("name").order("name"),
    supabase.from("parts").select("id, name").eq("active", true).order("name"),
    supabase.from("catalog_services").select("id, name").eq("active", true).order("name"),
  ]);
  const validade = q.valid_until ? new Date(q.valid_until).toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 16).replace(" ", "T") : "";
  const vencido = q.valid_until && new Date(q.valid_until).getTime() < Date.now() && ["rascunho", "enviado"].includes(q.status);
  const cfg = await lerConfig(supabase);
  const link = `${SITE}/orcamento/express/${q.public_token}`;
  const fone = String(q.clients?.mobile || q.clients?.phone || "").replace(/\D/g, "").replace(/^(\d{10,11})$/, "55$1");

  return (
    <main className="wrap">
      {erro && <div className="error" style={{ marginBottom: 10 }}>{erro}</div>}
      {ok && <div className="os-ok">Salvo.</div>}
      <div className="headrow" style={{ marginBottom: 12 }}>
        <h1 className="title" style={{ margin: 0 }}>
          Orçamento #{q.number} <span className="badge" style={vencido ? { background: "#fee2e2", color: "#991b1b" } : undefined}>{vencido ? "Vencido" : q.status}</span>
        </h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {editar && q.status === "rascunho" && (
            <form action={status}><input type="hidden" name="id" value={q.id} /><input type="hidden" name="status" value="enviado" /><button className="btn secondary">Marcar como enviado</button></form>
          )}
          {fone && <a className="btn secondary" target="_blank" rel="noreferrer" href={`https://wa.me/${fone}?text=${encodeURIComponent(preencher(cfg.msg_orcamento, { cliente: q.clients?.name, numero: q.number, link, saudacao: saudacao(), validade: q.valid_until ? new Date(q.valid_until).toLocaleDateString("pt-BR") : "" }))}`}>Enviar link</a>}
          <Link className="btn secondary" target="_blank" href={`/orcamento/express/${q.public_token}`}>Pré-visualizar</Link>
        </div>
      </div>
      <div className="muted" style={{ marginBottom: 10, wordBreak: "break-all" }}>Link do cliente: {link}</div>

      <form action={salvar} className="card grid g2">
        <input type="hidden" name="id" value={q.id} />
        <label className="field">Cliente
          <select name="client_id" defaultValue={q.client_id ?? ""} disabled={!editar}>
            <option value="">— escolha —</option>
            {(clientes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field">Título (opcional)<input name="title" defaultValue={q.title ?? ""} disabled={!editar} /></label>
        <label className="field">Relato do cliente<textarea name="report" rows={5} defaultValue={q.report ?? ""} disabled={!editar} placeholder="Ex.: Parou de ligar" /></label>
        <label className="field">Observações (o cliente vê)<textarea name="notes" rows={5} defaultValue={q.notes ?? ""} disabled={!editar} /></label>
        <label className="field">Validade<input type="datetime-local" name="valid_until" defaultValue={validade} disabled={!editar} /></label>
        <label className="field">Termos (garantia/condições)
          <select name="terms" defaultValue={q.terms ?? ""} disabled={!editar}>
            <option value="">—</option>
            {(termos ?? []).map((t: any) => <option key={t.name}>{t.name}</option>)}
          </select>
        </label>
        {editar && <div style={{ gridColumn: "1/-1" }}><button className="btn primary">Salvar</button></div>}
      </form>

      <h2 style={{ margin: "18px 0 8px" }}>Propostas</h2>
      {(ops ?? []).map((op: any) => {
        const its = (itens ?? []).filter((i: any) => i.option_id === op.id);
        const total = its.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price) - Number(i.discount), 0);
        return (
          <section key={op.id} className="card" style={{ marginBottom: 12, borderLeft: "4px solid #2563eb" }}>
            <form action={salvarOpcao} className="grid g2">
              <input type="hidden" name="id" value={q.id} /><input type="hidden" name="option_id" value={op.id} />
              <label className="field">Nome da proposta<input name="name" defaultValue={op.name} disabled={!editar} /></label>
              <div style={{ alignSelf: "end", textAlign: "right", fontSize: 20, fontWeight: 800, color: "#059669" }}>{moeda(total)}</div>
              <label className="field" style={{ gridColumn: "1/-1" }}>Descrição da proposta (o cliente vê)<textarea name="description" rows={2} defaultValue={op.description ?? ""} disabled={!editar} placeholder="Ex.: Troca da tela com peça original e 90 dias de garantia" /></label>
              <label className="field" style={{ gridColumn: "1/-1" }}>Formas de pagamento (o cliente vê)<textarea name="payment_forms" rows={2} defaultValue={op.payment_forms ?? ""} disabled={!editar} placeholder="Ex.: À vista no Pix · ou 3x no cartão" /></label>
              {editar && (
                <div style={{ gridColumn: "1/-1", display: "flex", gap: 8 }}>
                  <button className="btn primary">Salvar proposta</button>
                  {(ops ?? []).length > 1 && <button className="btn secondary" formAction={removerOpcao}>Remover proposta</button>}
                </div>
              )}
            </form>
            <table className="table" style={{ marginTop: 10 }}>
              <thead><tr><th>Tipo</th><th>Descrição</th><th>Qtd</th><th>Preço</th><th>Desconto</th><th>Subtotal</th><th></th></tr></thead>
              <tbody>
                {its.map((i: any) => (
                  <tr key={i.id}>
                    <td><span className="badge">{i.kind}</span></td><td>{i.description}</td><td>{Number(i.quantity)}</td>
                    <td>{moeda(Number(i.unit_price))}</td><td>{Number(i.discount) ? moeda(Number(i.discount)) : "—"}</td>
                    <td>{moeda(Number(i.quantity) * Number(i.unit_price) - Number(i.discount))}</td>
                    <td>{editar && <form action={removerItem}><input type="hidden" name="id" value={q.id} /><input type="hidden" name="item_id" value={i.id} /><button className="btn secondary">🗑</button></form>}</td>
                  </tr>
                ))}
                {!its.length && <tr><td colSpan={7} className="muted" style={{ textAlign: "center" }}>Nenhum item nesta proposta.</td></tr>}
              </tbody>
            </table>
            {editar && (
              <form action={addItem} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end", marginTop: 10 }}>
                <input type="hidden" name="id" value={q.id} /><input type="hidden" name="option_id" value={op.id} />
                <label className="field" style={{ width: 120 }}>Tipo
                  <select name="kind" defaultValue="servico"><option value="servico">Serviço</option><option value="produto">Produto</option><option value="avulso">Avulso</option></select>
                </label>
                <label className="field" style={{ minWidth: 200 }}>Do cadastro
                  <select name="catalogo" defaultValue="">
                    <option value="">—</option>
                    <optgroup label="Serviços">{(servicos ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
                    <optgroup label="Produtos">{(pecas ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
                  </select>
                </label>
                <label className="field" style={{ flex: 1, minWidth: 160 }}>Ou item avulso<input name="description" placeholder="Descrição" /></label>
                <label className="field" style={{ width: 70 }}>Qtd<input name="quantity" defaultValue="1" inputMode="decimal" /></label>
                <label className="field" style={{ width: 100 }}>Preço<input name="unit_price" defaultValue="0" inputMode="decimal" /></label>
                <label className="field" style={{ width: 90 }}>Desc.<input name="discount" defaultValue="0" inputMode="decimal" /></label>
                <button className="btn secondary">+ Adicionar</button>
              </form>
            )}
          </section>
        );
      })}
      {editar && (
        <form action={novaOpcao}><input type="hidden" name="id" value={q.id} />
          <button className="btn secondary" style={{ width: "100%", borderStyle: "dashed" }}>+ Adicionar outra proposta (ex.: peça original × compatível — o cliente escolhe uma)</button>
        </form>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, flexWrap: "wrap", gap: 8 }}>
        <Link className="btn secondary" href="/orcamentos">← Voltar</Link>
        {editar && (
          <div style={{ display: "flex", gap: 8 }}>
            {q.converted_os_id ? <Link className="btn primary" href={`/os/${q.converted_os_id}`}>Ver OS gerada</Link> : (
              <form action={converterOS}><input type="hidden" name="id" value={q.id} /><button className="btn primary">Converter em OS</button></form>
            )}
            {q.converted_sale_id ? <Link className="btn secondary" href={`/vendas/${q.converted_sale_id}`}>Ver venda gerada</Link> : (
              <form action={converterVenda}><input type="hidden" name="id" value={q.id} /><button className="btn secondary">Converter em Venda</button></form>
            )}
            <form action={excluir}><input type="hidden" name="id" value={q.id} /><button className="btn secondary">Excluir</button></form>
          </div>
        )}
      </div>
    </main>
  );
}
