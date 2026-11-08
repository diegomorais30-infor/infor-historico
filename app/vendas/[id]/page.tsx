import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { podeVer } from "@/lib/permissoes";
import { fmtData, moeda } from "@/lib/format";

export default async function Venda({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, perfil } = await getContexto();
  if (!podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro")) redirect("/dashboard");
  const { data: v } = await supabase.from("sales").select("*, clients(id, name)").eq("id", id).maybeSingle();
  if (!v) notFound();
  const [{ data: itens }, { data: lanc }] = await Promise.all([
    supabase.from("sale_items").select("id, description, quantity, unit_price, discount").eq("sale_id", id),
    supabase.from("finance_entries").select("id, description, amount, due_date, paid_at, payment_method").eq("sale_id", id).order("due_date"),
  ]);
  const sub = (itens ?? []).reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price) - Number(i.discount), 0);
  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <Link href="/vendas" className="btn secondary">← Vendas</Link>
      <h1 className="title" style={{ marginTop: 10 }}>Venda #{v.number}</h1>
      <section className="card">
        <p><b>Cliente:</b> {v.clients ? <Link href={`/clientes/${(v.clients as any).id}`}>{(v.clients as any).name}</Link> : "—"}</p>
        <p><b>Data:</b> {fmtData(v.sold_at)} · <b>Vendedor:</b> {v.seller ?? "—"} · <b>Situação:</b> {v.billed ? "Faturada" : "Em aberto"}</p>
        {v.notes && <p><b>Observações:</b> {v.notes}</p>}
      </section>
      <section className="card" style={{ marginTop: 12, overflowX: "auto" }}>
        <h2>Itens</h2>
        <table>
          <thead><tr><th>Descrição</th><th style={{ textAlign: "right" }}>Qtd</th><th style={{ textAlign: "right" }}>Valor unit.</th><th style={{ textAlign: "right" }}>Subtotal</th></tr></thead>
          <tbody>
            {(itens ?? []).map((i: any) => (
              <tr key={i.id}><td>{i.description}</td><td style={{ textAlign: "right" }}>{Number(i.quantity)}</td><td style={{ textAlign: "right" }}>{moeda(Number(i.unit_price))}</td><td style={{ textAlign: "right" }}>{moeda(Number(i.quantity) * Number(i.unit_price) - Number(i.discount))}</td></tr>
            ))}
          </tbody>
        </table>
        <p style={{ textAlign: "right" }}>Itens {moeda(sub)} · Desconto {moeda(Number(v.discount))} · Frete {moeda(Number(v.freight))} · <b>Total {moeda(Number(v.total))}</b></p>
      </section>
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
