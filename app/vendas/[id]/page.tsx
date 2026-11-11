import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { revalidatePath } from "next/cache";
import { podeEditar, podeVer } from "@/lib/permissoes";
import { fmtData, hojeBR, moeda } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const num = (v: FormDataEntryValue | null) => Number(String(v || "0").replace(",", ".")) || 0;
const volta = (id: string, e = "") => `/vendas/${id}${e}`;

async function recalcular(supabase: any, id: string) {
  const { data: it } = await supabase.from("sale_items").select("quantity, unit_price, discount").eq("sale_id", id);
  const { data: v } = await supabase.from("sales").select("discount, freight").eq("id", id).single();
  const sub = (it ?? []).reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price) - Number(i.discount), 0);
  await supabase.from("sales").update({ total: Math.max(sub - Number(v?.discount ?? 0) + Number(v?.freight ?? 0), 0) }).eq("id", id);
}

async function fatorLista(supabase: any, saleId: string) {
  const { data: v } = await supabase.from("sales").select("price_lists(adjust_percent)").eq("id", saleId).maybeSingle();
  return 1 + Number((v as any)?.price_lists?.adjust_percent ?? 0) / 100;
}

async function adicionarItem(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const ref = String(fd.get("ref") || "");
  const [tipo, rid] = ref.split(":");
  let description = String(fd.get("description") || "").trim();
  let unit_price = num(fd.get("unit_price"));
  let part_id: string | null = null;
  if (tipo === "p" && rid) {
    const { data: p } = await supabase.from("parts").select("name").eq("id", rid).single();
    const { data: pr } = await supabase.from("part_prices").select("sale_price").eq("part_id", rid).maybeSingle();
    description = description || (p as any)?.name || "Produto";
    if (!unit_price) unit_price = Math.round(Number((pr as any)?.sale_price ?? 0) * (await fatorLista(supabase, id)) * 100) / 100;
    part_id = rid;
  } else if (tipo === "s" && rid) {
    const { data: sv } = await supabase.from("catalog_services").select("name").eq("id", rid).single();
    const { data: pr } = await supabase.from("service_prices").select("price").eq("service_id", rid).maybeSingle();
    description = description || (sv as any)?.name || "Serviço";
    if (!unit_price) unit_price = Math.round(Number((pr as any)?.price ?? 0) * (await fatorLista(supabase, id)) * 100) / 100;
  }
  if (!description) redirect(volta(id, "?erro=" + encodeURIComponent("Escolha um item ou descreva.")));
  await supabase.from("sale_items").insert({
    sale_id: id,
    kind: tipo === "s" ? "servico" : "produto",
    description,
    quantity: num(fd.get("quantity")) || 1,
    unit_price,
    discount: num(fd.get("discount")),
    part_id,
  });
  await recalcular(supabase, id);
  revalidatePath(volta(id));
  redirect(volta(id));
}

async function adicionarKit(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const kit = String(fd.get("kit") || "");
  if (!kit) redirect(volta(id, "?erro=" + encodeURIComponent("Escolha um kit.")));
  const { data: its } = await supabase.from("kit_items").select("part_id, quantity, parts(name)").eq("kit_id", kit);
  if (!(its ?? []).length) redirect(volta(id, "?erro=" + encodeURIComponent("Esse kit não tem produtos cadastrados.")));
  const { data: precos } = await supabase.from("part_prices").select("part_id, sale_price").in("part_id", (its ?? []).map((i: any) => i.part_id));
  const pr = new Map((precos ?? []).map((x: any) => [x.part_id, Number(x.sale_price ?? 0)]));
  const fator = await fatorLista(supabase, id);
  await supabase.from("sale_items").insert((its ?? []).map((i: any) => ({
    sale_id: id, kind: "produto", description: i.parts?.name ?? "Produto", quantity: Number(i.quantity), unit_price: Math.round((pr.get(i.part_id) ?? 0) * fator * 100) / 100, discount: 0, part_id: i.part_id,
  })));
  await recalcular(supabase, id);
  revalidatePath(volta(id));
  redirect(volta(id));
}

async function removerItem(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  await supabase.from("sale_items").delete().eq("id", String(fd.get("item_id")));
  await recalcular(supabase, id);
  revalidatePath(volta(id));
  redirect(volta(id));
}

async function salvarCabecalho(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  await supabase.from("sales").update({
    sold_at: String(fd.get("sold_at") || "") || hojeBR(),
    seller: String(fd.get("seller") || "").trim() || null,
    notes: String(fd.get("notes") || "").trim() || null,
    discount: num(fd.get("discount")),
    freight: num(fd.get("freight")),
  }).eq("id", id);
  await recalcular(supabase, id);
  revalidatePath(volta(id));
  redirect(volta(id));
}

async function faturar(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const { data: v } = await supabase.from("sales").select("number, client_id, total, billed, stock_applied, seller, sold_at, clients(name)").eq("id", id).single();
  const venda: any = v;
  if (!venda || venda.billed) redirect(volta(id));
  if (Number(venda.total) <= 0) redirect(volta(id, "?erro=" + encodeURIComponent("Lance itens antes de faturar.")));
  const venc = String(fd.get("due_date") || "") || hojeBR();
  const pago = fd.get("pago") === "on";
  const { error } = await supabase.from("finance_entries").insert({
    kind: "receita",
    category: "Venda",
    description: `Venda #${venda.number}`,
    party: venda.clients?.name ?? null,
    client_id: venda.client_id,
    sale_id: id,
    origin: "venda",
    amount: venda.total,
    payment_method: String(fd.get("payment_method") || "").trim() || null,
    competence: venda.sold_at,
    due_date: venc,
    paid_at: pago ? hojeBR() : null,
  });
  if (error) redirect(volta(id, "?erro=" + encodeURIComponent(error.message)));
  if (!venda.stock_applied) {
    const { data: its } = await supabase.from("sale_items").select("part_id, quantity").eq("sale_id", id).not("part_id", "is", null);
    for (const i of (its ?? []) as any[]) {
      await supabase.from("stock_movements").insert({ part_id: i.part_id, quantity: -Number(i.quantity), reason: "venda", notes: `Venda #${venda.number}` });
    }
  }
  await supabase.from("sales").update({ billed: true, stock_applied: true }).eq("id", id);
  revalidatePath(volta(id));
  redirect(volta(id));
}

export default async function Venda({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { id } = await params;
  const { erro } = await searchParams;
  const { supabase, perfil } = await getContexto();
  if (!podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro")) redirect("/dashboard");
  const { data: v } = await supabase.from("sales").select("*, clients(id, name)").eq("id", id).maybeSingle();
  if (!v) notFound();
  const [{ data: itens }, { data: lanc }] = await Promise.all([
    supabase.from("sale_items").select("id, description, quantity, unit_price, discount").eq("sale_id", id),
    supabase.from("finance_entries").select("id, description, amount, due_date, paid_at, payment_method").eq("sale_id", id).order("due_date"),
  ]);
  const editFin = podeEditar(perfil?.role, (perfil as any)?.permissions, "financeiro");
  const aberta = !v.billed && editFin;
  const [{ data: pecas }, { data: servs }, { data: kits }] = aberta
    ? await Promise.all([
        supabase.from("parts").select("id, name").eq("active", true).order("name").limit(2000),
        supabase.from("catalog_services").select("id, name").eq("active", true).order("name"),
        supabase.from("kits").select("id, name").order("name"),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }, { data: [] as any[] }];
  const sub = (itens ?? []).reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price) - Number(i.discount), 0);
  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <Link href="/vendas" className="btn secondary">← Vendas</Link>
      <h1 className="title" style={{ marginTop: 10 }}>Venda #{v.number}</h1>
      {erro && <div className="error" style={{ margin: "10px 0" }}>{erro}</div>}
      <section className="card">
        <p><b>Cliente:</b> {v.clients ? <Link href={`/clientes/${(v.clients as any).id}`}>{(v.clients as any).name}</Link> : "—"}</p>
        <p><b>Data:</b> {fmtData(v.sold_at)} · <b>Vendedor:</b> {v.seller ?? "—"} · <b>Situação:</b> {v.billed ? "Faturada" : "Em aberto"}</p>
        {v.notes && <p><b>Observações:</b> {v.notes}</p>}
      </section>
      <section className="card" style={{ marginTop: 12, overflowX: "auto" }}>
        <h2>Itens</h2>
        <table>
          <thead><tr><th>Descrição</th><th style={{ textAlign: "right" }}>Qtd</th><th style={{ textAlign: "right" }}>Valor unit.</th><th style={{ textAlign: "right" }}>Subtotal</th>{aberta && <th></th>}</tr></thead>
          <tbody>
            {(itens ?? []).map((i: any) => (
              <tr key={i.id}><td>{i.description}</td><td style={{ textAlign: "right" }}>{Number(i.quantity)}</td><td style={{ textAlign: "right" }}>{moeda(Number(i.unit_price))}</td><td style={{ textAlign: "right" }}>{moeda(Number(i.quantity) * Number(i.unit_price) - Number(i.discount))}</td>{aberta && <td><form action={removerItem}><input type="hidden" name="id" value={id} /><input type="hidden" name="item_id" value={i.id} /><button className="btn secondary">Remover</button></form></td>}</tr>
            ))}
          </tbody>
        </table>
        {aberta && (
          <form action={adicionarItem} className="grid g4" style={{ marginTop: 12 }}>
            <input type="hidden" name="id" value={id} />
            <label className="field" style={{ gridColumn: "span 2" }}>
              Produto / serviço
              <select name="ref" defaultValue="">
                <option value="">Item avulso (digite abaixo)</option>
                <optgroup label="Produtos">{(pecas ?? []).map((p: any) => <option key={p.id} value={`p:${p.id}`}>{p.name}</option>)}</optgroup>
                <optgroup label="Serviços">{(servs ?? []).map((p: any) => <option key={p.id} value={`s:${p.id}`}>{p.name}</option>)}</optgroup>
              </select>
            </label>
            <label className="field">Descrição (avulso)<input name="description" /></label>
            <label className="field">Qtd<input name="quantity" inputMode="decimal" defaultValue="1" /></label>
            <label className="field">Valor unit. (vazio = tabela)<input name="unit_price" inputMode="decimal" /></label>
            <label className="field">Desconto<input name="discount" inputMode="decimal" defaultValue="0" /></label>
            <div style={{ alignSelf: "end" }}><button className="btn primary">Adicionar item</button></div>
          </form>
        )}
        {aberta && (kits ?? []).length > 0 && (
          <form action={adicionarKit} className="grid g4" style={{ marginTop: 12 }}>
            <input type="hidden" name="id" value={id} />
            <label className="field" style={{ gridColumn: "span 2" }}>Kit
              <select name="kit" defaultValue=""><option value="">Escolha um kit…</option>{(kits ?? []).map((k: any) => <option key={k.id} value={k.id}>{k.name}</option>)}</select>
            </label>
            <div style={{ alignSelf: "end" }}><button className="btn secondary">🧩 Adicionar kit</button></div>
          </form>
        )}
        <p style={{ textAlign: "right" }}>Itens {moeda(sub)} · Desconto {moeda(Number(v.discount))} · Frete {moeda(Number(v.freight))} · <b>Total {moeda(Number(v.total))}</b></p>
      </section>
      {aberta && (
        <section className="card" style={{ marginTop: 12 }}>
          <h2>Ajustes</h2>
          <form action={salvarCabecalho} className="grid g4">
            <input type="hidden" name="id" value={id} />
            <label className="field">Data<input type="date" name="sold_at" defaultValue={v.sold_at ?? ""} /></label>
            <label className="field">Vendedor<input name="seller" defaultValue={v.seller ?? ""} /></label>
            <label className="field">Desconto (R$)<input name="discount" inputMode="decimal" defaultValue={Number(v.discount)} /></label>
            <label className="field">Frete (R$)<input name="freight" inputMode="decimal" defaultValue={Number(v.freight)} /></label>
            <label className="field" style={{ gridColumn: "1/-1" }}>Observações<input name="notes" defaultValue={v.notes ?? ""} /></label>
            <div><button className="btn secondary">Salvar ajustes</button></div>
          </form>
          <h2 style={{ marginTop: 16 }}>Faturar</h2>
          <form action={faturar} className="grid g4">
            <input type="hidden" name="id" value={id} />
            <label className="field">Vencimento<input type="date" name="due_date" defaultValue={hojeBR()} /></label>
            <label className="field">Forma de pagamento<input name="payment_method" list="formas" placeholder="Pix, Dinheiro, Cartão…" /><datalist id="formas">{["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Boleto", "Transferência"].map((f) => <option key={f} value={f} />)}</datalist></label>
            <label className="field" style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><input type="checkbox" name="pago" /> Já recebido</label>
            <div style={{ alignSelf: "end" }}><button className="btn primary">Faturar venda</button></div>
          </form>
        </section>
      )}
      <section className="card" style={{ marginTop: 12, overflowX: "auto" }}>
        <h2>Financeiro</h2>
        <table>
          <thead><tr><th>Descrição</th><th>Vencimento</th><th>Pago em</th><th>Forma</th><th style={{ textAlign: "right" }}>Valor</th></tr></thead>
          <tbody>
            {(lanc ?? []).map((l: any) => (
              <tr key={l.id}><td>{l.description}</td><td>{fmtData(l.due_date)}</td><td>{l.paid_at ? fmtData(l.paid_at) : "Em aberto"}</td><td>{l.payment_method ?? "—"}</td><td style={{ textAlign: "right" }}>{moeda(Number(l.amount))}</td></tr>
            ))}
            {!(lanc ?? []).length && <tr><td colSpan={5} className="muted">Sem lançamento ligado.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
