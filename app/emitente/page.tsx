import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { fmtData } from "@/lib/format";

async function salvarEmpresa(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const t = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const { error } = await supabase.from("companies").update({
    document: t("document"), address: t("address"), phone: t("phone"), email: t("email"), whatsapp: t("whatsapp"),
    entry_terms: t("entry_terms"), exit_terms: t("exit_terms"),
  }).eq("id", String(formData.get("id")));
  revalidatePath("/emitente");
  redirect("/emitente?" + (error ? "erro=" + encodeURIComponent(error.message) : "ok=1"));
}

export default async function Emitente({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const { data: e } = await supabase.from("companies").select("id, name, document, address, phone, email, entry_terms, exit_terms, plan, trial_ends_at, max_equipment, whatsapp, slug").eq("id", (perfil as any).company_id).single();
  const admin = perfil?.role === "admin";
  const linha = (t: string, v: any) => (<tr><th style={{ textAlign: "left", width: 220 }}>{t}</th><td>{v ?? "—"}</td></tr>);
  return (
    <main className="wrap" style={{ maxWidth: 800 }}>
      <h1 className="title">Emitente e parâmetros</h1>
      {ok && <p className="card" style={{ marginTop: 12 }}>Dados da empresa salvos.</p>}
      {erro && <p className="alert">{erro}</p>}
      <section className="card" style={{ marginTop: 12 }}>
        <table><tbody>
          {linha("Empresa", e?.name)}{linha("Identificador (QR)", e?.slug)}
          {linha("Plano", e?.plan)}{linha("Limite de equipamentos", e?.max_equipment)}{linha("Teste grátis até", e?.trial_ends_at ? fmtData(e.trial_ends_at) : null)}
        </tbody></table>
        <p className="muted">Filiais, certificado e dados fiscais ainda não são usados: as notas são emitidas fora do sistema.</p>
      </section>
      <section className="card" style={{ marginTop: 14 }}>
        <h2 style={{ marginTop: 0 }}>Dados que saem na impressão da OS</h2>
        <form action={salvarEmpresa} className="grid g2">
          <input type="hidden" name="id" value={e?.id} />
          <label className="field">CNPJ<input name="document" defaultValue={e?.document ?? ""} disabled={!admin} /></label>
          <label className="field">Telefone<input name="phone" defaultValue={e?.phone ?? ""} disabled={!admin} /></label>
          <label className="field">E-mail<input name="email" type="email" defaultValue={e?.email ?? ""} disabled={!admin} /></label>
          <label className="field">WhatsApp<input name="whatsapp" defaultValue={e?.whatsapp ?? ""} disabled={!admin} /></label>
          <label className="field" style={{ gridColumn: "1/-1" }}>Endereço<input name="address" defaultValue={e?.address ?? ""} disabled={!admin} /></label>
          <label className="field" style={{ gridColumn: "1/-1" }}>Termo de entrada (impresso na OS aberta)<textarea name="entry_terms" rows={6} defaultValue={e?.entry_terms ?? ""} disabled={!admin} /></label>
          <label className="field" style={{ gridColumn: "1/-1" }}>Termo de saída / garantia (impresso na OS concluída)<textarea name="exit_terms" rows={6} defaultValue={e?.exit_terms ?? ""} disabled={!admin} /></label>
          {admin ? <div style={{ gridColumn: "1/-1" }}><button className="btn primary">Salvar</button></div> : <p className="muted" style={{ gridColumn: "1/-1" }}>Só o administrador altera estes dados.</p>}
        </form>
      </section>
    </main>
  );
}
