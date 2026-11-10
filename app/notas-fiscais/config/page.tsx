import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { podeEditar, podeVer } from "@/lib/permissoes";

const REGIMES = ["Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI"];
const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

async function salvar(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const t = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const { error } = await supabase.from("nfse_config").upsert({
    unit_type: String(formData.get("unit_type")) === "filial" ? "filial" : "matriz",
    municipal_registration: t("municipal_registration"),
    cep: t("cep"), street: t("street"), number: t("number"), complement: t("complement"), district: t("district"), city: t("city"), state: t("state"),
    rps_series: t("rps_series") ?? "1",
    rps_next: Math.max(1, parseInt(String(formData.get("rps_next") || "1"), 10) || 1),
    tax_regime: t("tax_regime"),
    environment: String(formData.get("environment")) === "producao" ? "producao" : "homologacao",
    provider: t("provider"),
    certificate_note: t("certificate_note"),
    updated_at: new Date().toISOString(),
  }, { onConflict: "company_id" });
  revalidatePath("/notas-fiscais/config");
  redirect("/notas-fiscais/config?" + (error ? "erro=" + encodeURIComponent(error.message) : "ok=1"));
}

export default async function ConfigNF({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const perms = (perfil as any)?.permissions;
  if (!podeVer(perfil?.role, perms, "financeiro")) redirect("/dashboard");
  const editar = podeEditar(perfil?.role, perms, "financeiro") && perfil?.role === "admin";
  const { data: c } = await supabase.from("nfse_config").select("*").maybeSingle();
  const d = (k: string) => (c as any)?.[k] ?? "";
  const dis = !editar;

  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <div className="headrow">
        <h1 className="title">Configurações de NF</h1>
        <Link className="btn secondary" href="/notas-fiscais">Notas fiscais</Link>
      </div>
      {ok && <p className="card" style={{ marginTop: 12 }}>Configuração salva.</p>}
      {erro && <p className="error" style={{ marginTop: 12 }}>{erro}</p>}

      <section className="card" style={{ marginTop: 12 }}>
        <h2>Entenda como configurar as notas fiscais</h2>
        <p className="muted">A configuração é feita apenas uma vez, antes da emissão da 1ª nota fiscal. Você pode continuar mais tarde. Estas são as informações solicitadas — vale copiar a lista e enviar para a sua contabilidade:</p>
        <ul style={{ margin: "8px 0 0 18px" }}>
          <li>Tipo de unidade da empresa (matriz ou filial)</li>
          <li>Número da inscrição municipal (pode ser encontrado com a prefeitura de onde a empresa atua)</li>
          <li>Endereço fiscal da empresa (o que aparece em documentos contábeis)</li>
          <li>Número do Recibo Provisório de Serviços (RPS) — verifique a última nota fiscal emitida</li>
          <li>Regime tributário (Simples Nacional, por exemplo)</li>
          <li>Arquivo do certificado digital A1 (vinculado ao CNPJ da empresa)</li>
        </ul>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h2>Dados fiscais</h2>
        <form action={salvar} className="grid g3" style={{ marginTop: 10 }}>
          <label className="field">Tipo de unidade
            <select name="unit_type" defaultValue={d("unit_type") || "matriz"} disabled={dis}><option value="matriz">Matriz</option><option value="filial">Filial</option></select>
          </label>
          <label className="field">Inscrição municipal<input name="municipal_registration" defaultValue={d("municipal_registration")} disabled={dis} /></label>
          <label className="field">Regime tributário
            <select name="tax_regime" defaultValue={d("tax_regime")} disabled={dis}><option value="">Selecione</option>{REGIMES.map((r) => <option key={r}>{r}</option>)}</select>
          </label>
          <label className="field">CEP<input name="cep" defaultValue={d("cep")} disabled={dis} /></label>
          <label className="field" style={{ gridColumn: "span 2" }}>Rua<input name="street" defaultValue={d("street")} disabled={dis} /></label>
          <label className="field">Número<input name="number" defaultValue={d("number")} disabled={dis} /></label>
          <label className="field">Complemento<input name="complement" defaultValue={d("complement")} disabled={dis} /></label>
          <label className="field">Bairro<input name="district" defaultValue={d("district")} disabled={dis} /></label>
          <label className="field">Cidade<input name="city" defaultValue={d("city")} disabled={dis} /></label>
          <label className="field">UF
            <select name="state" defaultValue={d("state")} disabled={dis}><option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
          </label>
          <label className="field">Série do RPS<input name="rps_series" defaultValue={d("rps_series") || "1"} disabled={dis} /></label>
          <label className="field">Próximo nº do RPS<input name="rps_next" inputMode="numeric" defaultValue={d("rps_next") || 1} disabled={dis} /></label>
          <label className="field">Ambiente
            <select name="environment" defaultValue={d("environment") || "homologacao"} disabled={dis}><option value="homologacao">Homologação (testes)</option><option value="producao">Produção</option></select>
          </label>
          <label className="field">Emissor (integração)<input name="provider" placeholder="a definir (ex.: Focus NFe)" defaultValue={d("provider")} disabled={dis} /></label>
          <label className="field" style={{ gridColumn: "span 2" }}>Certificado digital A1 — observação (validade, quem guarda)<input name="certificate_note" defaultValue={d("certificate_note")} disabled={dis} /></label>
          <p className="muted" style={{ gridColumn: "1/-1", margin: 0 }}>O arquivo do certificado A1 não é guardado aqui: ele só será enviado ao emissor escolhido, quando a integração for ativada.</p>
          <div style={{ gridColumn: "1/-1" }}>
            {editar ? <button className="btn primary">Salvar configuração</button> : <span className="muted">Só o administrador altera estes dados.</span>}
          </div>
        </form>
      </section>
    </main>
  );
}
