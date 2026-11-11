import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { moeda } from "@/lib/format";

async function criar(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const name = String(fd.get("name") || "").trim();
  if (!name) redirect("/kits?erro=" + encodeURIComponent("Informe o nome do kit."));
  const { error } = await supabase.from("kits").insert({ name });
  if (error) redirect("/kits?erro=" + encodeURIComponent(error.message));
  revalidatePath("/kits");
  redirect("/kits");
}

async function excluir(fd: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("kits").delete().eq("id", String(fd.get("id")));
  revalidatePath("/kits");
  redirect("/kits");
}

async function addItem(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const part_id = String(fd.get("part_id") || "");
  if (!part_id) redirect("/kits?erro=" + encodeURIComponent("Escolha o produto."));
  await supabase.from("kit_items").insert({ kit_id: String(fd.get("kit_id")), part_id, quantity: Number(String(fd.get("quantity") || "1").replace(",", ".")) || 1 });
  revalidatePath("/kits");
  redirect("/kits");
}

async function delItem(fd: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("kit_items").delete().eq("id", String(fd.get("id")));
  revalidatePath("/kits");
  redirect("/kits");
}

export default async function Kits({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const { supabase } = await getContexto();
  const [{ data: kits }, { data: itens }, { data: pecas }, { data: precos }] = await Promise.all([
    supabase.from("kits").select("id, name").order("name"),
    supabase.from("kit_items").select("id, kit_id, part_id, quantity, parts(name)"),
    supabase.from("parts").select("id, name").eq("active", true).order("name").limit(5000),
    supabase.from("part_prices").select("part_id, sale_price"),
  ]);
  const pr = new Map((precos ?? []).map((x: any) => [x.part_id, Number(x.sale_price ?? 0)]));
  return (
    <main className="wrap">
      <h1 className="title">Kits</h1>
      <p className="muted">Conjuntos de produtos vendidos juntos; na venda, o kit entra com todos os itens de uma vez</p>
      {erro && <div className="error" style={{ margin: "10px 0" }}>{erro}</div>}
      <form action={criar} className="card" style={{ margin: "12px 0", display: "flex", gap: 8, alignItems: "end" }}>
        <label className="field" style={{ flex: 1 }}>Nome do kit<input name="name" required /></label>
        <button className="btn primary">+ Novo kit</button>
      </form>
      {(kits ?? []).map((k: any) => {
        const its = (itens ?? []).filter((i: any) => i.kit_id === k.id);
        const total = its.reduce((s: number, i: any) => s + Number(i.quantity) * (pr.get(i.part_id) ?? 0), 0);
        return (
          <section key={k.id} className="card" style={{ marginBottom: 12, overflowX: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <h3 style={{ margin: 0 }}>{k.name} <span className="muted">· {moeda(total)}</span></h3>
              <form action={excluir}><input type="hidden" name="id" value={k.id} /><button className="btn secondary">Excluir kit</button></form>
            </div>
            <table className="table">
              <thead><tr><th>Produto</th><th>Qtd</th><th>Preço de venda</th><th /></tr></thead>
              <tbody>
                {its.map((i: any) => (
                  <tr key={i.id}><td>{i.parts?.name}</td><td>{Number(i.quantity)}</td><td>{moeda(pr.get(i.part_id) ?? 0)}</td>
                    <td><form action={delItem}><input type="hidden" name="id" value={i.id} /><button className="btn secondary">Remover</button></form></td></tr>
                ))}
                {!its.length && <tr><td colSpan={4} className="muted">Nenhum produto no kit.</td></tr>}
              </tbody>
            </table>
            <form action={addItem} className="grid g4" style={{ marginTop: 8 }}>
              <input type="hidden" name="kit_id" value={k.id} />
              <label className="field" style={{ gridColumn: "span 2" }}>Produto
                <select name="part_id" defaultValue=""><option value="">Escolha…</option>{(pecas ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </label>
              <label className="field">Qtd<input name="quantity" inputMode="decimal" defaultValue="1" /></label>
              <div style={{ alignSelf: "end" }}><button className="btn secondary">+ Adicionar</button></div>
            </form>
          </section>
        );
      })}
      {!(kits ?? []).length && <p className="muted">Nenhum kit cadastrado.</p>}
    </main>
  );
}
