import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtData, fmtDataHora, moeda } from "@/lib/format";
import Assinatura from "./assinatura";

// Página pública: o cliente vê o orçamento da OS e aprova ou recusa com assinatura.
async function responder(formData: FormData) {
  "use server";
  const token = String(formData.get("token"));
  const decisao = String(formData.get("decisao"));
  const nome = String(formData.get("nome") || "").trim().slice(0, 120);
  const assinatura = String(formData.get("assinatura") || "");
  const obs = String(formData.get("obs") || "").trim().slice(0, 500);
  const admin = createAdminClient();
  const { data: os } = await admin.from("service_orders").select("id, status, approval_status").eq("approval_token", token).single();
  if (!os || (os as any).approval_status !== "pendente") return;
  if (!nome) return;
  if (decisao === "aprovado" && !assinatura.startsWith("data:image/png;base64,")) return;
  const o: any = os;
  const upd: any = {
    approval_status: decisao === "aprovado" ? "aprovado" : "recusado",
    approval_at: new Date().toISOString(),
    approval_name: nome,
    approval_signature: decisao === "aprovado" ? assinatura.slice(0, 200000) : null,
    approval_note: obs || null,
  };
  if (decisao === "aprovado" && ["entrada", "orcamento"].includes(o.status)) upd.status = "aberto";
  await admin.from("service_orders").update(upd).eq("id", o.id);
  revalidatePath(`/orcamento/${token}`);
}

export default async function Orcamento({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const admin = createAdminClient();
  const { data } = await admin
    .from("service_orders")
    .select("id, number, company_id, defect, report, entry_at, approval_status, approval_at, approval_name, approval_signature, clients(name), equipment(code, brand, model, serial_number), companies(name)")
    .eq("approval_token", token)
    .single();
  if (!data || !(data as any).approval_status) notFound();
  const o: any = data;
  const [{ data: itens }, { data: precos }, { data: fin }] = await Promise.all([
    admin.from("service_order_items").select("id, kind, description, quantity").eq("order_id", o.id).order("created_at"),
    admin.from("item_prices").select("item_id, unit_price").eq("company_id", o.company_id),
    admin.from("order_finance").select("discount, advance").eq("order_id", o.id).maybeSingle(),
  ]);
  const preco: Record<string, number> = {};
  for (const r of precos ?? []) preco[(r as any).item_id] = Number((r as any).unit_price);
  const sub = (itens ?? []).reduce((t: number, i: any) => t + Number(i.quantity) * (preco[i.id] ?? 0), 0);
  const desc = Number((fin as any)?.discount ?? 0);
  const adiant = Number((fin as any)?.advance ?? 0);
  const total = Math.max(sub - desc, 0);

  return (
    <main className="wrap" style={{ maxWidth: 760 }}>
      <section className="card" style={{ lineHeight: 1.5 }}>
        <div className="muted">{o.companies?.name}</div>
        <h1 className="title" style={{ margin: "2px 0 8px" }}>Orçamento · OS #{o.number}</h1>
        <p>
          <b>Cliente:</b> {o.clients?.name}
          <br />
          <b>Equipamento:</b>{" "}
          {o.equipment ? `${o.equipment.code} · ${o.equipment.brand ?? ""} ${o.equipment.model ?? ""} · série ${o.equipment.serial_number ?? "—"}` : "—"}
          <br />
          <b>Entrada:</b> {fmtData(o.entry_at)}
        </p>
        {o.defect && (
          <p>
            <b>Defeito relatado:</b> {o.defect}
          </p>
        )}
        {o.report && (
          <p>
            <b>Laudo técnico:</b> {o.report}
          </p>
        )}
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qtd</th>
              <th>Valor unit.</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(itens ?? []).map((i: any) => (
              <tr key={i.id}>
                <td>{i.description}</td>
                <td>{Number(i.quantity)}</td>
                <td>{moeda(preco[i.id] ?? 0)}</td>
                <td>{moeda(Number(i.quantity) * (preco[i.id] ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ textAlign: "right" }}>
          Subtotal {moeda(sub)}
          {desc > 0 && <> · Desconto {moeda(desc)}</>} · <b>Total {moeda(total)}</b>
          {adiant > 0 && <> · Adiantamento {moeda(adiant)} · <b>A pagar {moeda(Math.max(total - adiant, 0))}</b></>}
        </p>
      </section>

      {o.approval_status === "pendente" ? (
        <form action={responder} className="card grid" style={{ marginTop: 14, gap: 12 }}>
          <input type="hidden" name="token" value={token} />
          <h2 style={{ margin: 0 }}>Sua resposta</h2>
          <label className="field">
            Seu nome
            <input name="nome" required />
          </label>
          <label className="field">
            Observação (opcional)
            <textarea name="obs" rows={2} />
          </label>
          <div>
            <div className="muted" style={{ marginBottom: 4 }}>Assinatura (necessária para aprovar)</div>
            <Assinatura />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn primary" name="decisao" value="aprovado">Aprovar orçamento</button>
            <button className="btn secondary" name="decisao" value="recusado" formNoValidate>Recusar</button>
          </div>
        </form>
      ) : (
        <section className="card" style={{ marginTop: 14 }}>
          <h2 style={{ marginTop: 0 }}>{o.approval_status === "aprovado" ? "Orçamento aprovado" : "Orçamento recusado"}</h2>
          <p className="muted">
            Por {o.approval_name} em {fmtDataHora(o.approval_at)}.
          </p>
          {o.approval_signature && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={o.approval_signature} alt="Assinatura" style={{ background: "#fff", borderRadius: 8, maxWidth: 300 }} />
          )}
        </section>
      )}
    </main>
  );
}
