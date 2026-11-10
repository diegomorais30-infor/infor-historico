import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtData, moeda } from "@/lib/format";

// Página pública do Orçamento Express: o cliente vê as propostas e aprova uma.
async function responder(fd: FormData) {
  "use server";
  const token = String(fd.get("token"));
  const decisao = String(fd.get("decisao"));
  const nome = String(fd.get("nome") || "").trim().slice(0, 120);
  const opcao = String(fd.get("opcao") || "");
  if (!nome) return;
  const admin = createAdminClient();
  const { data: q } = await admin.from("quotes").select("id, status, valid_until").eq("public_token", token).single();
  const o: any = q;
  if (!o || !["rascunho", "enviado"].includes(o.status)) return;
  if (o.valid_until && new Date(o.valid_until).getTime() < Date.now()) return;
  if (decisao === "aprovado") {
    const { data: ok } = await admin.from("quote_options").select("id").eq("id", opcao).eq("quote_id", o.id).maybeSingle();
    if (!ok) return;
    await admin.from("quotes").update({ status: "aprovado", chosen_option: opcao, approved_name: nome, approved_at: new Date().toISOString() }).eq("id", o.id);
  } else {
    await admin.from("quotes").update({ status: "reprovado", approved_name: nome, approved_at: new Date().toISOString() }).eq("id", o.id);
  }
  revalidatePath(`/orcamento/express/${token}`);
}

export default async function Publico({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const admin = createAdminClient();
  const { data } = await admin.from("quotes").select("*, clients(name), companies(name)").eq("public_token", token).single();
  if (!data) notFound();
  const q: any = data;
  const [{ data: ops }, { data: itens }] = await Promise.all([
    admin.from("quote_options").select("*").eq("quote_id", q.id).order("position"),
    admin.from("quote_items").select("*, quote_options!inner(quote_id)").eq("quote_options.quote_id", q.id).order("id"),
  ]);
  if (q.status === "rascunho") await admin.from("quotes").update({ status: "enviado" }).eq("id", q.id).eq("status", "rascunho");
  const vencido = q.valid_until && new Date(q.valid_until).getTime() < Date.now();
  const aberto = ["rascunho", "enviado"].includes(q.status) && !vencido;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif", color: "#1f2937" }}>
      <h1 style={{ marginBottom: 2 }}>Orçamento #{q.number}</h1>
      <div style={{ color: "#6b7280", marginBottom: 12 }}>{q.companies?.name} · para {q.clients?.name ?? "—"}{q.valid_until ? ` · válido até ${fmtData(q.valid_until)}` : ""}</div>
      {q.title && <h2 style={{ marginTop: 0 }}>{q.title}</h2>}
      {q.report && <p><b>Relato:</b> {q.report}</p>}
      {q.notes && <p style={{ whiteSpace: "pre-wrap" }}>{q.notes}</p>}
      {(ops ?? []).map((op: any) => {
        const its = (itens ?? []).filter((i: any) => i.option_id === op.id);
        const total = its.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price) - Number(i.discount), 0);
        const escolhida = q.chosen_option === op.id;
        return (
          <section key={op.id} style={{ border: escolhida ? "2px solid #10b981" : "1px solid #e5e7eb", borderRadius: 10, padding: 14, margin: "12px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><b>{op.name}{escolhida ? " ✔ escolhida" : ""}</b><b style={{ color: "#059669", fontSize: 20 }}>{moeda(total)}</b></div>
            {op.description && <p>{op.description}</p>}
            <ul>{its.map((i: any) => <li key={i.id}>{Number(i.quantity)}x {i.description} — {moeda(Number(i.quantity) * Number(i.unit_price) - Number(i.discount))}</li>)}</ul>
            {op.payment_forms && <p style={{ color: "#6b7280" }}><b>Pagamento:</b> {op.payment_forms}</p>}
          </section>
        );
      })}
      {q.terms && <p style={{ color: "#6b7280" }}>Termos: {q.terms}</p>}
      {aberto ? (
        <form action={responder} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}>
          <input type="hidden" name="token" value={token} />
          <label style={{ display: "block", marginBottom: 8 }}>Seu nome<input name="nome" required style={{ width: "100%", padding: 8 }} /></label>
          {(ops ?? []).length > 1 || true ? (
            <label style={{ display: "block", marginBottom: 8 }}>Proposta escolhida
              <select name="opcao" style={{ width: "100%", padding: 8 }}>{(ops ?? []).map((op: any) => <option key={op.id} value={op.id}>{op.name}</option>)}</select>
            </label>
          ) : null}
          <div style={{ display: "flex", gap: 8 }}>
            <button name="decisao" value="aprovado" style={{ background: "#059669", color: "#fff", border: 0, borderRadius: 8, padding: "10px 16px", fontWeight: 700 }}>Aprovar orçamento</button>
            <button name="decisao" value="reprovado" style={{ background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 16px" }}>Recusar</button>
          </div>
        </form>
      ) : (
        <p><b>{vencido && ["rascunho", "enviado"].includes(q.status) ? "Este orçamento venceu." : q.status === "reprovado" ? "Orçamento recusado." : "Orçamento aprovado — obrigado!"}</b>{q.approved_name ? ` (${q.approved_name})` : ""}</p>
      )}
    </main>
  );
}
