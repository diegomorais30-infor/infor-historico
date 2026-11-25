import { notFound } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { fmtData, moeda } from "@/lib/format";
import { podeVer } from "@/lib/permissoes";
import CabecalhoEmpresa, { CAMPOS_EMPRESA } from "@/components/cabecalho-empresa";
import BotaoImprimir, { BotaoImprimirFlutuante } from "@/components/botao-imprimir";

export default async function ImprimirCompra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, perfil } = await getContexto();
  if (!podeVer(perfil?.role, (perfil as any)?.permissions, "compras")) notFound();
  const { data: c } = await supabase.from("purchases").select("*, suppliers(name, document, phone, email, address, city, state)").eq("id", id).single();
  if (!c) notFound();
  const { data: emp } = await supabase.from("companies").select(CAMPOS_EMPRESA).eq("id", (perfil as any).company_id).single();
  const { data: itens } = await supabase.from("purchase_items").select("id, description, quantity, unit_price, discount").eq("purchase_id", id).order("description");
  const f: any = (c as any).suppliers ?? {};
  const sub = (itens ?? []).reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price) - Number(i.discount ?? 0), 0);
  const desc = Number((c as any).discount ?? 0);
  const th: React.CSSProperties = { border: "1px solid #ddd", padding: "6px 8px", background: "#f0f0f0", fontSize: 11.5, textAlign: "left" };
  const td: React.CSSProperties = { border: "1px solid #ddd", padding: "6px 8px", fontSize: 12.5 };
  return (
    <main className="wrap" style={{ maxWidth: 820 }}>
      <BotaoImprimirFlutuante />
      <div className="no-print" style={{ marginBottom: 12 }}><BotaoImprimir /></div>
      <div className="doc-folha" style={{ background: "#fff", color: "#000", padding: "10mm 12mm", fontFamily: "Arial, Helvetica, sans-serif", boxSizing: "border-box" }}>
        <CabecalhoEmpresa emp={emp as any} direita={<><div><b>#Compra:</b> {(c as any).number}</div><div>Data: {fmtData((c as any).purchased_at)}</div></>} />
        <div style={{ fontSize: 12.5, lineHeight: 1.5, padding: "10px 0", borderBottom: "1px solid #ddd" }}>
          <div><b>Fornecedor:</b> {f.name ?? "—"}</div>
          {f.document && <div>{f.document}</div>}
          {[f.address, [f.city, f.state].filter(Boolean).join(" - ")].filter(Boolean).length > 0 && <div>{[f.address, [f.city, f.state].filter(Boolean).join(" - ")].filter(Boolean).join(", ")}</div>}
          {(f.phone || f.email) && <div>{[f.phone, f.email].filter(Boolean).join(" - ")}</div>}
        </div>
        <table className="sem-grade" style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
          <thead><tr><th style={th}>Item</th><th style={{ ...th, width: 50, textAlign: "right" }}>Qtd.</th><th style={{ ...th, width: 90, textAlign: "right" }}>Valor un.</th><th style={{ ...th, width: 100, textAlign: "right" }}>Sub-total</th></tr></thead>
          <tbody>
            {(itens ?? []).map((i: any) => (
              <tr key={i.id}>
                <td style={td}>{i.description}</td>
                <td style={{ ...td, textAlign: "right" }}>{Number(i.quantity)}</td>
                <td style={{ ...td, textAlign: "right" }}>{moeda(Number(i.unit_price))}</td>
                <td style={{ ...td, textAlign: "right" }}>{moeda(Number(i.quantity) * Number(i.unit_price) - Number(i.discount ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: "right", fontSize: 12.5, marginTop: 8, lineHeight: 1.6 }}>
          {desc > 0 && <div>Desconto: {moeda(desc)}</div>}
          <div style={{ fontSize: 15 }}><b>Total: {moeda(Math.max(sub - desc, 0))}</b></div>
        </div>
        {(c as any).notes && <p style={{ fontSize: 12, whiteSpace: "pre-wrap", marginTop: 10 }}><b>Observações:</b> {(c as any).notes}</p>}
      </div>
    </main>
  );
}
