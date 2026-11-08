import { getContexto } from "@/lib/contexto";
import { fmtData } from "@/lib/format";

export default async function Emitente() {
  const { supabase, perfil } = await getContexto();
  const { data: e } = await supabase.from("companies").select("name, document, plan, trial_ends_at, max_equipment, whatsapp, slug").eq("id", (perfil as any).company_id).single();
  const linha = (t: string, v: any) => (<tr><th style={{ textAlign: "left", width: 220 }}>{t}</th><td>{v ?? "—"}</td></tr>);
  return (
    <main className="wrap" style={{ maxWidth: 800 }}>
      <h1 className="title">Emitente e parâmetros</h1>
      <section className="card" style={{ marginTop: 12 }}>
        <table><tbody>
          {linha("Empresa", e?.name)}{linha("CNPJ", e?.document)}{linha("WhatsApp", e?.whatsapp)}{linha("Identificador (QR)", e?.slug)}
          {linha("Plano", e?.plan)}{linha("Limite de equipamentos", e?.max_equipment)}{linha("Teste grátis até", e?.trial_ends_at ? fmtData(e.trial_ends_at) : null)}
        </tbody></table>
        <p className="muted">Filiais, certificado e dados fiscais ainda não são usados: as notas são emitidas fora do sistema.</p>
      </section>
    </main>
  );
}
