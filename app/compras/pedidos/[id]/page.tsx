import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { moeda } from "@/lib/format";
import { podeEditar } from "@/lib/permissoes";

const ROT: Record<string, string> = { aberto: "Aberto", enviado: "Enviado ao fornecedor", convertido: "Convertido em compra", cancelado: "Cancelado" };
const volta = (id: string, erro?: string) => `/compras/pedidos/${id}${erro ? "?erro=" + encodeURIComponent(erro) : ""}`;

async function salvar(fd: FormData) {
  "use server";
  const { supabase } = await getContexto();
  const id = String(fd.get("id"));
  await supabase.from("purchase_orders").update({
    supplier_id: String(fd.get("supplier_id") || "") || null,
    expected_at: String(fd.get("expected_at") || "") || null,
    status: String(fd.get("status") || "aberto"),
    notes: String(fd.get("notes") || "").trim() || null,
  }).eq("id", id);
  revalidatePath(`/compras/pedidos/${id}`);
  redirect(volta(id));
}

async function addItem(fd: FormData) {
  "use server";
  const { supabase } = await getContexto();
  const id = String(fd.get("id"));
  const part_id = String(fd.get("part_id") || "") || null;
  let description = String(fd.get("description") || "").trim();
  if (part_id && !description) {
    const { data: p } = await supabase.from("parts").select("name").eq("id", part_id).maybeSingle();
    description = (p as any)?.name ?? "";
  }
  if (!description) redirect(volta(id, "Escolha um produto ou escreva a descrição."));
  const { error } = await supabase.from("purchase_order_items").insert({
    order_id: id, part_id, description,
    quantity: Number(String(fd.get("quantity") || "1").replace(",", ".")) || 1,
    unit_price: Number(String(fd.get("unit_price") || "0").replace(",", ".")) || 0,
  });
  if (error) redirect(volta(id, error.message));
  revalidatePath(`/compras/pedidos/${id}`);
  redirect(volta(id));
}

async function delItem(fd: FormData) {
  "use server";
  const { supabase } = await getContexto();
  const id = String(fd.get("id"));
  await supabase.from("purchase_order_items").delete().eq("id", String(fd.get("item")));
  revalidatePath(`/compras/pedidos/${id}`);
  redirect(volta(id));
}

async function excluir(fd: FormData) {
  "use server";
  const { supabase } = await getContexto();
  await supabase.from("purchase_orders").delete().eq("id", String(fd.get("id")));
  redirect("/compras/pedidos");
}

// "Importar do pedido": gera a compra com os itens do pedido
async function gerarCompra(fd: FormData) {
  "use server";
  const { supabase } = await getContexto();
  const id = String(fd.get("id"));
  const { data: ped } = await supabase.from("purchase_orders").select("supplier_id, number, purchase_id, purchase_order_items(part_id, description, quantity, unit_price)").eq("id", id).single();
  const p: any = ped;
  if (!p) redirect(volta(id, "Pedido não encontrado."));
  if (p.purchase_id) redirect(`/compras/${p.purchase_id}`);
  if (!(p.purchase_order_items ?? []).length) redirect(volta(id, "Adicione itens ao pedido antes de gerar a compra."));
  const { data: ult } = await supabase.from("purchases").select("number").order("number", { ascending: false }).limit(1);
  const number = Number((ult as any)?.[0]?.number ?? 0) + 1;
  const { data: c, error } = await supabase.from("purchases").insert({ number, supplier_id: p.supplier_id, notes: `Gerada do pedido de compra ${p.number}` }).select("id").single();
  if (error || !c) redirect(volta(id, error?.message ?? "Erro ao criar a compra."));
  await supabase.from("purchase_items").insert(p.purchase_order_items.map((i: any) => ({ purchase_id: (c as any).id, part_id: i.part_id, description: i.description, quantity: i.quantity, unit_price: i.unit_price })));
  await supabase.from("purchase_orders").update({ status: "convertido", purchase_id: (c as any).id }).eq("id", id);
  redirect(`/compras/${(c as any).id}`);
}

export default async function Pedido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { id } = await params;
  const { erro } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const editar = podeEditar(perfil?.role, (perfil as any)?.permissions, "pecas");
  const { data: ped } = await supabase.from("purchase_orders").select("id, number, supplier_id, status, expected_at, notes, purchase_id").eq("id", id).maybeSingle();
  if (!ped) notFound();
  const p: any = ped;
  const [{ data: itens }, { data: fornecedores }, { data: pecas }, { data: compra }] = await Promise.all([
    supabase.from("purchase_order_items").select("id, description, quantity, unit_price").eq("order_id", id).order("description"),
    supabase.from("suppliers").select("id, name").eq("active", true).order("name"),
    supabase.from("parts").select("id, name").eq("active", true).order("name").limit(5000),
    p.purchase_id ? supabase.from("purchases").select("id, number").eq("id", p.purchase_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const total = (itens ?? []).reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0);
  const trava = !editar || p.status === "convertido";
  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 14 }}>
        <div><h1 className="title">Pedido de compra #{p.number}</h1><div className="muted">{ROT[p.status] ?? p.status}</div></div>
        <Link href="/compras/pedidos" className="btn secondary">← Pedidos</Link>
      </div>
      {erro && <div className="error" style={{ marginBottom: 10 }}>{erro}</div>}
      {compra && <div className="card" style={{ marginBottom: 12 }}>Compra gerada: <Link href={`/compras/${(compra as any).id}`} style={{ color: "var(--link)", fontWeight: 800 }}>#{(compra as any).number}</Link></div>}
      <form action={salvar} className="card grid g2" style={{ marginBottom: 12 }}>
        <input type="hidden" name="id" value={p.id} />
        <label className="field">Fornecedor
          <select name="supplier_id" defaultValue={p.supplier_id ?? ""} disabled={trava}>
            <option value="">—</option>
            {(fornecedores ?? []).map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label className="field">Previsão de entrega<input type="date" name="expected_at" defaultValue={p.expected_at ?? ""} disabled={trava} /></label>
        <label className="field">Situação
          <select name="status" defaultValue={p.status} disabled={trava}>
            {Object.entries(ROT).filter(([k]) => k !== "convertido").map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </label>
        <label className="field">Observações<input name="notes" defaultValue={p.notes ?? ""} disabled={trava} /></label>
        {!trava && <div><button className="btn primary">Salvar</button> <Link href="/fornecedores" className="btn secondary" style={{ marginLeft: 6 }}>+ Novo fornecedor</Link></div>}
      </form>
      <section className="card" style={{ marginBottom: 12, overflowX: "auto" }}>
        <h3 style={{ marginTop: 0 }}>Itens do pedido</h3>
        <table className="table">
          <thead><tr><th>Produto</th><th>Qtd</th><th>Valor unit.</th><th>Subtotal</th><th /></tr></thead>
          <tbody>
            {(itens ?? []).map((i: any) => (
              <tr key={i.id}>
                <td>{i.description}</td><td>{Number(i.quantity)}</td><td>{moeda(i.unit_price)}</td><td>{moeda(Number(i.quantity) * Number(i.unit_price))}</td>
                <td>{!trava && <form action={delItem}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="item" value={i.id} /><button className="btn secondary">Remover</button></form>}</td>
              </tr>
            ))}
            {!(itens ?? []).length && <tr><td colSpan={5} className="muted">Nenhum item.</td></tr>}
          </tbody>
          <tfoot><tr><th colSpan={3} style={{ textAlign: "right" }}>Total</th><th>{moeda(total)}</th><th /></tr></tfoot>
        </table>
        {!trava && (
          <form action={addItem} className="grid g4" style={{ marginTop: 12 }}>
            <input type="hidden" name="id" value={p.id} />
            <label className="field" style={{ gridColumn: "span 2" }}>Produto
              <select name="part_id" defaultValue=""><option value="">— (ou escreva a descrição)</option>{(pecas ?? []).map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            </label>
            <label className="field">Descrição livre<input name="description" /></label>
            <label className="field">Qtd<input name="quantity" inputMode="decimal" defaultValue="1" /></label>
            <label className="field">Valor unit.<input name="unit_price" inputMode="decimal" defaultValue="0" /></label>
            <div style={{ alignSelf: "end" }}><button className="btn primary">+ Adicionar item</button></div>
          </form>
        )}
      </section>
      {editar && (
        <div style={{ display: "flex", gap: 8 }}>
          {p.status !== "convertido" && p.status !== "cancelado" && <form action={gerarCompra}><input type="hidden" name="id" value={p.id} /><button className="btn primary">Gerar compra a partir do pedido</button></form>}
          {p.status !== "convertido" && <form action={excluir}><input type="hidden" name="id" value={p.id} /><button className="btn secondary">Excluir pedido</button></form>}
        </div>
      )}
    </main>
  );
}
