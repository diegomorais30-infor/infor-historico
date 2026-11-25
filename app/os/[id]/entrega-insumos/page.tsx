import { notFound } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { fmtData, moeda } from "@/lib/format";
import { podeVer } from "@/lib/permissoes";
import CabecalhoEmpresa, { CAMPOS_EMPRESA } from "@/components/cabecalho-empresa";
import BotaoImprimir, { BotaoImprimirFlutuante } from "@/components/botao-imprimir";

export default async function EntregaInsumos({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ vias?: string }> }) {
  const { id } = await params;
  const duasVias = (await searchParams).vias !== "1";
  const { supabase, perfil } = await getContexto();
  const { data: o } = await supabase
    .from("service_orders")
    .select("number, entry_at, location, clients(name, document, phone, mobile, address, street_number, neighborhood, city, state), equipment(equipment_type, brand, model, serial_number, asset_tag)")
    .eq("id", id)
    .single();
  if (!o) notFound();
  const { data: emp } = await supabase.from("companies").select(CAMPOS_EMPRESA).eq("id", (perfil as any).company_id).single();
  const { data: itens } = await supabase.from("service_order_items").select("id, kind, description, quantity").eq("order_id", id).order("created_at");
  const insumos = (itens ?? []).filter((i: any) => i.kind === "peca");
  const lista = insumos.length ? insumos : (itens ?? []);
  const verFin = podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro");
  const preco: Record<string, number> = {};
  if (verFin && lista.length) {
    const { data: ip } = await supabase.from("item_prices").select("item_id, unit_price").in("item_id", lista.map((i: any) => i.id));
    for (const r of ip ?? []) preco[(r as any).item_id] = Number((r as any).unit_price);
  }
  const total = lista.reduce((t: number, i: any) => t + Number(i.quantity) * (preco[i.id] ?? 0), 0);
  const ncol = verFin ? 4 : 2;
  const c: any = (o as any).clients ?? {};
  const eq: any = (o as any).equipment;
  const end = [[c.address, c.street_number].filter(Boolean).join(", "), c.neighborhood, [c.city, c.state].filter(Boolean).join(" - ")].filter(Boolean).join(", ");
  const th: React.CSSProperties = { border: "1px solid #ddd", padding: "6px 8px", background: "#f0f0f0", fontSize: 11.5, textAlign: "left" };
  const td: React.CSSProperties = { border: "1px solid #ddd", padding: "7px 8px", fontSize: 12.5 };
  return (
    <main className="wrap" style={{ maxWidth: 820 }}>
      <BotaoImprimirFlutuante />
      <div className="no-print" style={{ marginBottom: 12 }}>
        <BotaoImprimir />{" "}
        <a className="btn secondary" href={`/os/${id}/imprimir`}>← Impressão da OS</a>{" "}
        <a className="btn secondary" href={`/os/${id}/entrega-insumos?vias=${duasVias ? "1" : "2"}`}>{duasVias ? "Uma via por folha" : "2 vias por folha"}</a>
      </div>
      <div className={duasVias ? "vias2" : undefined}>
      {(duasVias ? ["Via da empresa", "Via do cliente"] : [null]).map((rot) => (
      <div key={rot ?? "u"} className={`doc-folha${duasVias ? " via" : ""}`} style={{ background: "#fff", color: "#000", padding: "10mm 12mm", fontFamily: "Arial, Helvetica, sans-serif", boxSizing: "border-box" }}>
        {rot && <div className="via-rotulo">{rot}</div>}
        <CabecalhoEmpresa emp={emp as any} direita={<><div><b>Entrega de insumos</b></div><div>OS #{(o as any).number}</div><div>Data: {fmtData(new Date().toISOString())}</div></>} />
        <div style={{ fontSize: 12.5, lineHeight: 1.5, padding: "10px 0", borderBottom: "1px solid #ddd" }}>
          <div><b>Cliente:</b> {c.name ?? "—"}</div>
          {c.document && <div>{c.document}</div>}
          {end && <div>{end}</div>}
          {(c.mobile || c.phone) && <div>{c.mobile || c.phone}</div>}
          {(o as any).location && <div><b>Setor:</b> {(o as any).location}</div>}
          {eq && <div><b>Equipamento:</b> {[eq.equipment_type, eq.brand, eq.model].filter(Boolean).join(" ")}{eq.serial_number ? ` · série ${eq.serial_number}` : ""}{eq.asset_tag ? ` · patrimônio ${eq.asset_tag}` : ""}</div>}
        </div>
        <table className="sem-grade" style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
          <thead><tr><th style={th}>Insumo / peça entregue</th><th style={{ ...th, width: 70, textAlign: "right" }}>Qtd.</th>{verFin && <><th style={{ ...th, width: 90, textAlign: "right" }}>Valor un.</th><th style={{ ...th, width: 100, textAlign: "right" }}>Sub-total</th></>}</tr></thead>
          <tbody>
            {lista.map((i: any) => (<tr key={i.id}><td style={td}>{i.description}</td><td style={{ ...td, textAlign: "right" }}>{Number(i.quantity)}</td>{verFin && <><td style={{ ...td, textAlign: "right" }}>{moeda(preco[i.id] ?? 0)}</td><td style={{ ...td, textAlign: "right" }}>{moeda(Number(i.quantity) * (preco[i.id] ?? 0))}</td></>}</tr>))}
            {!lista.length && <tr><td style={td} colSpan={ncol}>Nenhum item lançado na OS.</td></tr>}
          </tbody>
        </table>
        {verFin && lista.length > 0 && <div style={{ textAlign: "right", fontSize: 15, marginTop: 8 }}><b>Total: {moeda(total)}</b></div>}
        <p style={{ fontSize: 12, marginTop: 14 }}>Declaro ter recebido os insumos acima em perfeitas condições.</p>
        <div style={{ display: "flex", gap: 40, marginTop: 60, fontSize: 12 }}>
          <div style={{ flex: 1, textAlign: "center", borderTop: "1px solid #666", paddingTop: 4 }}>{c.name}<br />Data: ____/____/______</div>
          <div style={{ flex: 1, textAlign: "center", borderTop: "1px solid #666", paddingTop: 4 }}>{(emp as any)?.name}</div>
        </div>
      </div>
      ))}
      </div>
    </main>
  );
}
