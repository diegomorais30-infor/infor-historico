import Link from "next/link";
import { redirect } from "next/navigation";
import ConfigTabela from "@/components/config-tabela";
import { getContexto } from "@/lib/contexto";
import { fmtData, moeda } from "@/lib/format";
import { podeEditar } from "@/lib/permissoes";

async function nova() {
  "use server";
  const { supabase } = await getContexto();
  const { data: ult } = await supabase.from("purchases").select("number").order("number", { ascending: false }).limit(1);
  const number = Number((ult as any)?.[0]?.number ?? 0) + 1;
  const { data, error } = await supabase.from("purchases").insert({ number }).select("id").single();
  if (error) redirect("/compras?erro=" + encodeURIComponent(error.message));
  redirect(`/compras/${(data as any).id}`);
}

export default async function Compras({ searchParams }: { searchParams: Promise<{ q?: string; de?: string; ate?: string; erro?: string }> }) {
  const { q, de, ate, erro } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const editar = podeEditar(perfil?.role, (perfil as any)?.permissions, "pecas");
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const ini = de || hoje.slice(0, 8) + "01";
  const fim = ate || hoje.slice(0, 8) + "31";

  const { data } = await supabase
    .from("purchases")
    .select("id, number, purchased_at, discount, legacy_total, invoiced, suppliers(name)")
    .gte("purchased_at", ini + "T00:00:00-03:00")
    .lte("purchased_at", fim + "T23:59:59-03:00")
    .order("purchased_at", { ascending: false })
    .limit(500);
  const compras: any[] = data ?? [];
  const ids = compras.map((c) => c.id);
  const [{ data: its }, { data: cts }] = ids.length
    ? await Promise.all([
        supabase.from("purchase_items").select("purchase_id, description, quantity, received_qty, unit_price, discount").in("purchase_id", ids),
        supabase.from("purchase_costs").select("purchase_id, amount").in("purchase_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const info = (c: any) => {
    const itens = (its ?? []).filter((i: any) => i.purchase_id === c.id);
    const custos = (cts ?? []).filter((x: any) => x.purchase_id === c.id).reduce((s: number, x: any) => s + Number(x.amount), 0);
    const sub = itens.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price) - Number(i.discount), 0);
    const total = itens.length ? Math.max(sub + custos - Number(c.discount), 0) : Number(c.legacy_total ?? 0);
    const rec = itens.length ? itens.every((i: any) => Number(i.received_qty) >= Number(i.quantity)) : true;
    return { itens, total, rec };
  };
  const t = (q ?? "").trim().toLowerCase();
  const lista = compras.filter((c) => {
    if (!t) return true;
    const { itens } = info(c);
    return [String(c.number), c.suppliers?.name, ...itens.map((i: any) => i.description)].filter(Boolean).some((x: string) => x.toLowerCase().includes(t));
  });

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 14 }}>
        <div>
          <h1 className="title">Compras</h1>
          <div className="muted">Entradas de mercadoria dos fornecedores e os pedidos de compra</div>
        </div>
        {editar && (
          <form action={nova}>
            <button className="btn primary">+ Nova compra</button>
          </form>
        )}
      </div>
      {erro && <div className="error" style={{ marginBottom: 10 }}>{erro}</div>}
      <form className="card" style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <label className="field">De<input type="date" name="de" defaultValue={ini} /></label>
        <label className="field">Até<input type="date" name="ate" defaultValue={fim} /></label>
        <label className="field" style={{ flex: 1, minWidth: 200 }}>Buscar<input name="q" defaultValue={q ?? ""} placeholder="Número, fornecedor ou produto" /></label>
        <button className="btn secondary">Filtrar</button>
      </form>
      <section className="card" style={{ overflowX: "auto" }}>
        <ConfigTabela chave="compras" />
        <table className="table">
          <thead><tr><th>#</th><th>Data</th><th>Fornecedor</th><th>Produtos</th><th>Total da compra</th><th>Ações</th></tr></thead>
          <tbody>
            {lista.map((c) => {
              const x = info(c);
              return (
                <tr key={c.id}>
                  <td><Link href={`/compras/${c.id}`} style={{ color: "var(--link)", fontWeight: 800 }}>{c.number}</Link></td>
                  <td>{fmtData(c.purchased_at)}</td>
                  <td>{c.suppliers?.name ?? "—"}</td>
                  <td>
                    <span className="badge" style={{ background: x.rec ? "#dcfce7" : "#fef3c7", color: x.rec ? "#166534" : "#92400e" }}>{x.rec ? "Recebido" : "Pendente"}</span>{" "}
                    {x.itens.slice(0, 2).map((i: any) => i.description).join(", ")}{x.itens.length > 2 ? ` +${x.itens.length - 2}` : ""}
                  </td>
                  <td><span className="badge">{c.invoiced ? "Faturado" : "Não faturado"}</span><div><b>{moeda(x.total)}</b></div></td>
                  <td><Link className="btn primary" href={`/compras/${c.id}`} title="Editar">✎</Link></td>
                </tr>
              );
            })}
            {!lista.length && <tr><td colSpan={6} className="muted" style={{ textAlign: "center" }}>Nenhuma compra no período.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
