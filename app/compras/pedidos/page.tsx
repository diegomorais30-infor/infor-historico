import Link from "next/link";
import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { fmtData, moeda } from "@/lib/format";
import { podeEditar } from "@/lib/permissoes";

async function novo() {
  "use server";
  const { supabase } = await getContexto();
  const { data: ult } = await supabase.from("purchase_orders").select("number").order("number", { ascending: false }).limit(1);
  const number = Number((ult as any)?.[0]?.number ?? 0) + 1;
  const { data, error } = await supabase.from("purchase_orders").insert({ number }).select("id").single();
  if (error) redirect("/compras/pedidos?erro=" + encodeURIComponent(error.message));
  redirect(`/compras/pedidos/${(data as any).id}`);
}

const ROT: Record<string, string> = { aberto: "Aberto", enviado: "Enviado ao fornecedor", convertido: "Convertido em compra", cancelado: "Cancelado" };

export default async function Pedidos({ searchParams }: { searchParams: Promise<{ q?: string; st?: string; erro?: string }> }) {
  const { q, st, erro } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const editar = podeEditar(perfil?.role, (perfil as any)?.permissions, "pecas");
  let qb = supabase.from("purchase_orders").select("id, number, status, expected_at, created_at, purchase_id, suppliers(name), purchase_order_items(quantity, unit_price, description)").order("number", { ascending: false }).limit(500);
  if (st && ROT[st]) qb = qb.eq("status", st);
  const { data } = await qb;
  const t = (q ?? "").trim().toLowerCase();
  const lista = ((data ?? []) as any[]).filter((p) => !t || [String(p.number), p.suppliers?.name, ...(p.purchase_order_items ?? []).map((i: any) => i.description)].filter(Boolean).some((x: string) => x.toLowerCase().includes(t)));
  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 14 }}>
        <div>
          <h1 className="title">Pedidos de compra</h1>
          <div className="muted">O que foi pedido aos fornecedores, antes da mercadoria chegar</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/compras" className="btn secondary">← Compras</Link>
          {editar && <form action={novo}><button className="btn primary">+ Novo pedido</button></form>}
        </div>
      </div>
      {erro && <div className="error" style={{ marginBottom: 10 }}>{erro}</div>}
      <form className="card" style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <label className="field" style={{ flex: 1, minWidth: 200 }}>Buscar<input name="q" defaultValue={q ?? ""} placeholder="Número, fornecedor ou produto" /></label>
        <label className="field">Situação
          <select name="st" defaultValue={st ?? ""}><option value="">Todas</option>{Object.entries(ROT).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
        </label>
        <button className="btn secondary">Filtrar</button>
      </form>
      <section className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead><tr><th>#</th><th>Data</th><th>Fornecedor</th><th>Itens</th><th>Previsão</th><th>Situação</th><th>Total</th></tr></thead>
          <tbody>
            {lista.map((p) => {
              const its = p.purchase_order_items ?? [];
              const total = its.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0);
              return (
                <tr key={p.id}>
                  <td><Link href={`/compras/pedidos/${p.id}`} style={{ color: "var(--link)", fontWeight: 800 }}>{p.number}</Link></td>
                  <td>{fmtData(p.created_at)}</td>
                  <td>{p.suppliers?.name ?? "—"}</td>
                  <td>{its.slice(0, 2).map((i: any) => i.description).join(", ")}{its.length > 2 ? ` +${its.length - 2}` : ""}</td>
                  <td>{p.expected_at ? fmtData(p.expected_at) : "—"}</td>
                  <td><span className="badge">{ROT[p.status] ?? p.status}</span></td>
                  <td><b>{moeda(total)}</b></td>
                </tr>
              );
            })}
            {!lista.length && <tr><td colSpan={7} className="muted" style={{ textAlign: "center" }}>Nenhum pedido.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
