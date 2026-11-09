import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getContexto } from "@/lib/contexto";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtData, moeda } from "@/lib/format";
import { podeVer } from "@/lib/permissoes";
import { STATUS_OS } from "@/lib/os";
import BotaoImprimir from "./botao";

const dataHora = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default async function ImprimirOS({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, perfil } = await getContexto();
  const { data } = await supabase
    .from("service_orders")
    .select("*, clients(name, phone, mobile, document, address, street_number, neighborhood, city, state, cep), equipment(code, equipment_type, brand, model, serial_number, asset_tag, color)")
    .eq("id", id)
    .single();
  if (!data) notFound();
  const o: any = data;

  const { data: emp } = await supabase
    .from("companies")
    .select("name, document, address, email, phone, whatsapp, entry_terms, exit_terms")
    .eq("id", (perfil as any).company_id)
    .single();
  const { data: itens } = await supabase.from("service_order_items").select("id, kind, description, quantity").eq("order_id", id).order("created_at");
  const { data: atend } = o.created_by ? await supabase.from("profiles").select("full_name").eq("id", o.created_by).maybeSingle() : { data: null };
  const atendente = (atend as any)?.full_name ?? o.legacy_data?.lista?.atendente ?? null;

  const verFin = podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro");
  const preco: Record<string, number> = {};
  let desc = 0, adiant = 0;
  if (verFin && (itens ?? []).length) {
    const { data: ip } = await supabase.from("item_prices").select("item_id, unit_price");
    for (const r of ip ?? []) preco[(r as any).item_id] = Number((r as any).unit_price);
    const { data: of } = await supabase.from("order_finance").select("discount, advance").eq("order_id", id).maybeSingle();
    desc = Number((of as any)?.discount ?? 0);
    adiant = Number((of as any)?.advance ?? 0);
  }

  // QR "Veja o status da OS" (link público do orçamento/andamento) e fotos para a página de anexos
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://inforgest.com.br";
  const qr = o.approval_token ? await QRCode.toDataURL(`${site}/orcamento/${o.approval_token}`, { width: 260, margin: 0 }) : null;
  const { data: anexos } = await supabase.from("os_attachments").select("path").eq("order_id", id).order("path");
  let fotos: string[] = [];
  if ((anexos ?? []).length) {
    const { data: urls } = await createAdminClient().storage.from("os-anexos").createSignedUrls((anexos ?? []).map((a: any) => a.path), 3600);
    fotos = (urls ?? []).map((u: any) => u.signedUrl).filter(Boolean);
  }

  const c = o.clients ?? {};
  const eq = o.equipment;
  const enderecoCliente = [[c.address, c.street_number].filter(Boolean).join(", "), c.neighborhood].filter(Boolean).join(", ");
  const cidadeCliente = [c.city, c.state].filter(Boolean).join(" - ");
  const telCliente = c.mobile || c.phone;
  const sub = (itens ?? []).reduce((t: number, i: any) => t + Number(i.quantity) * (preco[i.id] ?? 0), 0);
  const total = Math.max(sub - desc, 0);
  const rotulo: React.CSSProperties = { fontSize: 12, fontWeight: 700, margin: "14px 0 4px" };
  const texto: React.CSSProperties = { fontSize: 12.5, whiteSpace: "pre-wrap", lineHeight: 1.45, margin: 0 };

  return (
    <main className="wrap" style={{ maxWidth: 820 }}>
      <div className="no-print" style={{ marginBottom: 12 }}>
        <BotaoImprimir />
      </div>
      <div className="os-folha">
        <section style={{ background: "#fff", color: "#000", padding: "10mm 12mm", fontFamily: "Arial, Helvetica, sans-serif", boxSizing: "border-box", minHeight: "277mm", display: "flex", flexDirection: "column" }}>
          {/* Cabeçalho: logo + dados da empresa + status da OS */}
          <div style={{ display: "flex", gap: 14, borderTop: "1px solid #ddd", borderBottom: "1px solid #ddd", padding: "8px 0" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-infor.jpg" alt="" style={{ width: 120, height: 120, objectFit: "contain" }} />
            <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.4 }}>
              <div style={{ fontSize: 22, fontWeight: 500 }}>{emp?.name}</div>
              {emp?.document && <div>CNPJ: {emp.document}</div>}
              {emp?.address && <div>{emp.address}</div>}
              <div>{[emp?.phone ?? emp?.whatsapp, emp?.email].filter(Boolean).join(" - ")}</div>
              {atendente && <div><b>Atendente:</b> {atendente}</div>}
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, minWidth: 190 }}>
              <div>Status: <b style={{ textTransform: "uppercase", letterSpacing: 1 }}>{STATUS_OS[o.status] ?? o.status}</b></div>
              {o.situacao && <div>Situação: <b style={{ textTransform: "uppercase", letterSpacing: 1 }}>{o.situacao}</b></div>}
              <div>#Ordem: <b>{o.number}</b></div>
              <div>Entrada: {dataHora(o.entry_at)}</div>
              {o.deadline && <div>Prazo: {fmtData(o.deadline)}</div>}
            </div>
          </div>

          {/* Cliente + QR */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, borderBottom: "1px solid #ddd", padding: "10px 0", marginTop: 12 }}>
            <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              <div><b>Cliente</b> {c.name}</div>
              {c.document && <div>{c.document}</div>}
              {enderecoCliente && <div>{enderecoCliente}</div>}
              {(cidadeCliente || telCliente) && <div>{[cidadeCliente, telCliente].filter(Boolean).join(" ")}</div>}
              {o.contact_name && <div>Solicitante: {o.contact_name}</div>}
            </div>
            {qr && (
              <div style={{ textAlign: "center", fontSize: 9, color: "#555" }}>
                Veja o status da OS
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR code do status da OS" style={{ width: 80, height: 80, display: "block", marginTop: 3 }} />
              </div>
            )}
          </div>

          <div style={rotulo}>Relato do Cliente</div>
          <p style={texto}>{o.defect || "—"}</p>

          {o.report && (<>
            <div style={{ ...rotulo, borderTop: "1px solid #ddd", paddingTop: 8 }}>Laudo Técnico</div>
            <p style={texto}>{o.report}</p>
          </>)}

          {o.quote_text && (<>
            <div style={{ ...rotulo, borderTop: "1px solid #ddd", paddingTop: 8 }}>Orçamento</div>
            <p style={texto}>{o.quote_text}</p>
          </>)}

          {(itens ?? []).length > 0 && (<>
            <div style={{ ...rotulo, borderTop: "1px solid #ddd", paddingTop: 8 }}>Serviços e peças</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <tbody>
                {(itens ?? []).map((i: any, k: number) => (
                  <tr key={k} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "3px 0", width: 60 }}>{i.kind === "peca" ? "Peça" : "Serviço"}</td>
                    <td style={{ padding: "3px 0" }}>{i.description}</td>
                    <td style={{ padding: "3px 0", width: 40, textAlign: "right" }}>{Number(i.quantity)}</td>
                    {verFin && <td style={{ padding: "3px 0", width: 90, textAlign: "right" }}>{moeda(Number(i.quantity) * (preco[i.id] ?? 0))}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {verFin && (
              <p style={{ textAlign: "right", fontSize: 12.5, margin: "6px 0 0" }}>
                Subtotal {moeda(sub)} · Desconto {moeda(desc)} · <b>Total {moeda(total)}</b>
                {adiant > 0 && <> · Adiantamento {moeda(adiant)} · <b>A pagar {moeda(Math.max(total - adiant, 0))}</b></>}
              </p>
            )}
          </>)}

          {/* Equipamento */}
          {eq && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, marginTop: 12 }}>
              <thead>
                <tr style={{ background: "#f0f0f0", color: "#555" }}>
                  {["Equipamento", "Marca", "Modelo", "SN/IMEI", "Cor", "Problema Relatado"].map((h) => (
                    <th key={h} style={{ border: "1px solid #ddd", padding: "5px 6px", textAlign: "center", fontSize: 10.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {[eq.equipment_type, eq.brand, eq.model, eq.serial_number, eq.color, o.defect].map((v, k) => (
                    <td key={k} style={{ border: "1px solid #ddd", padding: "6px", whiteSpace: "pre-wrap" }}>{v ?? ""}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}

          {/* Termo de entrada / garantia de saída */}
          {emp?.entry_terms && (<>
            <div style={rotulo}>{["concluido", "faturado", "finalizado"].includes(o.status) && emp?.exit_terms ? "Termo Saída" : "Termo Entrada"}</div>
            <p style={{ ...texto, fontSize: 11.5 }}>
              {["concluido", "faturado", "finalizado"].includes(o.status) && emp?.exit_terms ? emp.exit_terms : emp.entry_terms}
            </p>
          </>)}

          <div style={{ display: "flex", gap: 40, marginTop: "auto", paddingTop: 36, fontSize: 12 }}>
            <div style={{ flex: 1, textAlign: "center" }}>{c.name}<div style={{ borderTop: "1px solid #666", marginTop: 26 }} /></div>
            <div style={{ flex: 1, textAlign: "center" }}>{emp?.name}<div style={{ borderTop: "1px solid #666", marginTop: 26 }} /></div>
          </div>
        </section>

        {/* Página de anexos (fotos) */}
        {fotos.length > 0 && (
          <section style={{ background: "#fff", color: "#000", padding: "10mm 12mm", boxSizing: "border-box", minHeight: "277mm", breakBefore: "page", pageBreakBefore: "always", fontFamily: "Arial, Helvetica, sans-serif" }}>
            <div style={{ background: "#eee", textAlign: "center", fontWeight: 700, fontSize: 18, color: "#666", padding: 12, border: "1px solid #ddd" }}>Anexos</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              {fotos.map((u, k) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={k} src={u} alt="" style={{ width: "100%", height: 230, objectFit: "contain", border: "1px solid #ddd", background: "#fafafa", breakInside: "avoid" }} />
              ))}
            </div>
            <div style={{ textAlign: "right", fontSize: 10, marginTop: 16 }}>Emitido por InforGest</div>
          </section>
        )}
      </div>
    </main>
  );
}
