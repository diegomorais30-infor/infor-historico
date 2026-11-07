import { notFound } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { fmtData } from "@/lib/format";
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
    .select("kind, description, quantity")
    .eq("order_id", id)
    .order("created_at");
  const empresa = (perfil as any)?.companies?.name ?? "";

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
              </tr>
            ))}
            {!(itens ?? []).length && (
              <tr>
                <td className="muted">—</td>
              </tr>
            )}
          </tbody>
        </table>
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
