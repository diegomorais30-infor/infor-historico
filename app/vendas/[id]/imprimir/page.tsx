import { notFound } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { fmtData, moeda } from "@/lib/format";
import { podeVer } from "@/lib/permissoes";
import CabecalhoEmpresa, { CAMPOS_EMPRESA } from "@/components/cabecalho-empresa";
import BotaoImprimir, { BotaoImprimirFlutuante } from "@/components/botao-imprimir";

export default async function ImprimirVenda({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ vias?: string }> }) {
  const { id } = await params;
  const duasVias = (await searchParams).vias !== "1";
  const { supabase, perfil } = await getContexto();
  if (!podeVer(perfil?.role, (perfil as any)?.permissions, "vendas")) notFound();
  const { data: v } = await supabase
    .from("sales")
    .select("*, clients(name, document, phone, mobile, address, street_number, neighborhood, city, state)")
    .eq("id", id)
    .single();
  if (!v) notFound();
  const { data: emp } = await supabase.from("companies").select(CAMPOS_EMPRESA).eq("id", (perfil as any).company_id).single();
  const { data: itens } = await supabase.from("sale_items").select("id, description, quantity, unit_price, discount").eq("sale_id", id).order("description");
  const c: any = (v as any).clients ?? {};
  const end = [[c.address, c.street_number].filter(Boolean).join(", "), c.neighborhood, [c.city, c.state].filter(Boolean).join(" - ")].filter(Boolean).join(", ");
  const sub = (itens ?? []).reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price) - Number(i.discount ?? 0), 0);
  const desc = Number((v as any).discount ?? 0), frete = Number((v as any).freight ?? 0);
  const th: React.CSSProperties = { border: "1px solid #ddd", padding: "6px 8px", background: "#f0f0f0", fontSize: 11.5, textAlign: "left" };
  const td: React.CSSProperties = { border: "1px solid #ddd", padding: "6px 8px", fontSize: 12.5 };

  return (
    <main className="wrap" style={{ maxWidth: 820 }}>
      <BotaoImprimirFlutuante />
      <div className="no-print" style={{ marginBottom: 12 }}><BotaoImprimir />{" "}<a className="btn secondary" href={`/vendas/${id}/imprimir?vias=${duasVias ? "1" : "2"}`}>{duasVias ? "Uma via por folha" : "2 vias por folha"}</a></div>
      <div className={duasVias ? "vias2" : undefined}>
      {(duasVias ? ["Via da empresa", "Via do cliente"] : [null]).map((rot) => (
      <div key={rot ?? "u"} className={`doc-folha${duasVias ? " via" : ""}`} style={{ background: "#fff", color: "#000", padding: "10mm 12mm", fontFamily: "Arial, Helvetica, sans-serif", boxSizing: "border-box" }}>
        {rot && <div className="via-rotulo">{rot}</div>}
        <CabecalhoEmpresa
          emp={emp as any}
          linhaExtra={(v as any).seller ? <div><b>Vendedor:</b> {(v as any).seller}</div> : null}
          direita={<><div><b>#Venda:</b> {(v as any).number}</div><div>Data: {fmtData((v as any).sold_at)}</div></>}
        />
        <div style={{ fontSize: 12.5, lineHeight: 1.5, padding: "10px 0", borderBottom: "1px solid #ddd" }}>
          <div><b>Cliente:</b> {c.name ?? "—"}</div>
          {c.document && <div>{c.document}</div>}
          {end && <div>{end}</div>}
          {(c.mobile || c.phone) && <div>{c.mobile || c.phone}</div>}
          {(v as any).entrega && <div><b>Entrega</b>{(v as any).entrega_obs ? `: ${(v as any).entrega_obs}` : ""}</div>}
        </div>
        <table className="sem-grade" style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
          <thead><tr><th style={th}>Produto / serviço</th><th style={{ ...th, width: 50, textAlign: "right" }}>Qtd.</th><th style={{ ...th, width: 90, textAlign: "right" }}>Valor un.</th><th style={{ ...th, width: 100, textAlign: "right" }}>Sub-total</th></tr></thead>
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
          <div>Subtotal: {moeda(sub)}</div>
          {desc > 0 && <div>Desconto: {moeda(desc)}</div>}
          {frete > 0 && <div>Frete: {moeda(frete)}</div>}
          <div style={{ fontSize: 15 }}><b>Total: {moeda(Number((v as any).total))}</b>{(v as any).billed ? " · Faturado" : ""}</div>
        </div>
        {(v as any).notes && <p style={{ fontSize: 12, whiteSpace: "pre-wrap", marginTop: 10 }}><b>Observações:</b> {(v as any).notes}</p>}
        {(v as any).warranty_term && <p style={{ fontSize: 11.5, whiteSpace: "pre-wrap" }}><b>Garantia:</b> {(v as any).warranty_term}</p>}
        <div style={{ display: "flex", gap: 40, marginTop: 70, fontSize: 12 }}>
          <div style={{ flex: 1, textAlign: "center", borderTop: "1px solid #666", paddingTop: 4 }}>{c.name}</div>
          <div style={{ flex: 1, textAlign: "center", borderTop: "1px solid #666", paddingTop: 4 }}>{(emp as any)?.name}</div>
        </div>
      </div>
      ))}
      </div>
    </main>
  );
}
