import { notFound } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { fmtData, moeda } from "@/lib/format";
import { podeVer } from "@/lib/permissoes";
import { PRIORIDADE_OS, STATUS_OS } from "@/lib/os";
import BotaoImprimir from "./botao";

export default async function ImprimirOS({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, perfil } = await getContexto();
  const { data } = await supabase
    .from("service_orders")
    .select("*, clients(name, phone, document, address, city), equipment(code, brand, model, serial_number, asset_tag)")
    .eq("id", id)
    .single();
  if (!data) notFound();
  const o: any = data;
  const { data: itens } = await supabase
    .from("service_order_items")
    .select("id, kind, description, quantity")
    .eq("order_id", id)
    .order("created_at");
  const empresa = (perfil as any)?.companies?.name ?? "";
  const verFin = podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro");
  const preco: Record<string, number> = {};
  let desc = 0, adiant = 0;
  if (verFin) {
    const { data: ip } = await supabase.from("item_prices").select("item_id, unit_price");
    for (const r of ip ?? []) preco[(r as any).item_id] = Number((r as any).unit_price);
    const { data: of } = await supabase.from("order_finance").select("discount, advance").eq("order_id", id).maybeSingle();
    desc = Number((of as any)?.discount ?? 0);
    adiant = Number((of as any)?.advance ?? 0);
  }

  return (
    <main className="wrap" style={{ maxWidth: 820 }}>
      <div className="no-print" style={{ marginBottom: 12 }}>
        <BotaoImprimir />
      </div>
      <section className="card" style={{ lineHeight: 1.5 }}>
        <h1 className="title" style={{ marginBottom: 2 }}>
          Ordem de serviço #{o.number}
        </h1>
        <div className="muted">
          {empresa} · Entrada em {fmtData(o.entry_at)} · {STATUS_OS[o.status]} · Prioridade {PRIORIDADE_OS[o.priority]}
          {o.deadline && <> · Prazo {fmtData(o.deadline)}</>}
        </div>
        <hr />
        <p>
          <b>Cliente:</b> {o.clients?.name}
          {o.clients?.document && <> · {o.clients.document}</>}
          {o.clients?.phone && <> · {o.clients.phone}</>}
          <br />
          {(o.clients?.address || o.clients?.city) && (
            <>
              <b>Endereço:</b> {[o.clients.address, o.clients.city].filter(Boolean).join(" · ")}
            </>
          )}
        </p>
        <p>
          <b>Equipamento:</b>{" "}
          {o.equipment
            ? `${o.equipment.code} · ${o.equipment.brand ?? ""} ${o.equipment.model ?? ""} · série ${o.equipment.serial_number ?? "—"}${o.equipment.asset_tag ? ` · patrimônio ${o.equipment.asset_tag}` : ""}`
            : "—"}
        </p>
        <p>
          <b>Defeito relatado:</b>
          <br />
          {o.defect || "—"}
        </p>
        <p>
          <b>Serviços e peças:</b>
        </p>
        <table className="table">
          <tbody>
            {(itens ?? []).map((i: any, k: number) => (
              <tr key={k}>
                <td>{i.kind === "peca" ? "Peça" : "Serviço"}</td>
                <td>{i.description}</td>
                <td>{Number(i.quantity)}</td>
                {verFin && <td>{moeda(Number(i.quantity) * (preco[i.id] ?? 0))}</td>}
              </tr>
            ))}
            {!(itens ?? []).length && (
              <tr>
                <td className="muted">—</td>
              </tr>
            )}
          </tbody>
        </table>
        {verFin && (() => {
          const sub = (itens ?? []).reduce((t: number, i: any) => t + Number(i.quantity) * (preco[i.id] ?? 0), 0);
          const total = Math.max(sub - desc, 0);
          return (
            <p style={{ textAlign: "right" }}>
              Subtotal {moeda(sub)} · Desconto {moeda(desc)} · <b>Total {moeda(total)}</b>
              {adiant > 0 && <> · Adiantamento {moeda(adiant)} · <b>A pagar {moeda(Math.max(total - adiant, 0))}</b></>}
            </p>
          );
        })()}
        <p>
          <b>Laudo / serviço realizado:</b>
          <br />
          {o.report || "—"}
        </p>
        {o.external_invoice_number && (
          <p>
            <b>Nota fiscal:</b> {o.external_invoice_number}
          </p>
        )}
        <div style={{ display: "flex", gap: 40, marginTop: 48 }}>
          <div style={{ flex: 1, borderTop: "1px solid #888", paddingTop: 4, textAlign: "center" }}>Técnico</div>
          <div style={{ flex: 1, borderTop: "1px solid #888", paddingTop: 4, textAlign: "center" }}>Cliente</div>
        </div>
      </section>
    </main>
  );
}
