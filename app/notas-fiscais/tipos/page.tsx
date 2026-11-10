import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { podeEditar, podeVer } from "@/lib/permissoes";

const num = (v: FormDataEntryValue | null) => Number(String(v || "0").replace(",", ".")) || 0;

async function criar(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const t = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const nome = t("name");
  if (!nome) redirect("/notas-fiscais/tipos?erro=" + encodeURIComponent("Informe o nome do tipo de serviço."));
  const { error } = await supabase.from("nfse_service_types").insert({
    name: nome, service_code: t("service_code"), municipal_code: t("municipal_code"), cnae: t("cnae"),
    iss_rate: num(formData.get("iss_rate")), iss_withheld: formData.get("iss_withheld") === "on", description: t("description"),
  });
  revalidatePath("/notas-fiscais/tipos");
  redirect("/notas-fiscais/tipos" + (error ? "?erro=" + encodeURIComponent(error.message) : ""));
}
async function alternar(formData: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("nfse_service_types").update({ active: formData.get("ativar") === "1" }).eq("id", String(formData.get("id")));
  revalidatePath("/notas-fiscais/tipos");
  redirect("/notas-fiscais/tipos");
}
async function excluir(formData: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("nfse_service_types").delete().eq("id", String(formData.get("id")));
  revalidatePath("/notas-fiscais/tipos");
  redirect("/notas-fiscais/tipos");
}

export default async function TiposServico({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const perms = (perfil as any)?.permissions;
  if (!podeVer(perfil?.role, perms, "financeiro")) redirect("/dashboard");
  const editar = podeEditar(perfil?.role, perms, "financeiro");
  const { data } = await supabase.from("nfse_service_types").select("*").order("name");
  const lista: any[] = data ?? [];
  return (
    <main className="wrap" style={{ maxWidth: 980 }}>
      <div className="headrow">
        <div>
          <h1 className="title">Tipos de serviço (NFS-e)</h1>
          <p className="muted">Cadastre os serviços que saem na nota fiscal, com o código e a alíquota de ISS definidos com a sua contabilidade.</p>
        </div>
        <Link className="btn secondary" href="/notas-fiscais/config">Configurações de NF</Link>
      </div>
      {erro && <p className="error" style={{ marginBottom: 12 }}>{erro}</p>}
      {editar && (
        <details className="card" style={{ marginBottom: 14 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>+ Novo tipo de serviço</summary>
          <form action={criar} className="grid g3" style={{ marginTop: 12 }}>
            <label className="field">Nome<input name="name" required placeholder="Ex.: Manutenção de impressoras" /></label>
            <label className="field">Código do serviço (LC 116)<input name="service_code" placeholder="Ex.: 14.01" /></label>
            <label className="field">Código municipal<input name="municipal_code" /></label>
            <label className="field">CNAE<input name="cnae" /></label>
            <label className="field">Alíquota ISS (%)<input name="iss_rate" inputMode="decimal" defaultValue="0" /></label>
            <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input name="iss_withheld" type="checkbox" style={{ width: "auto" }} /> ISS retido</label>
            <label className="field" style={{ gridColumn: "1/-1" }}>Descrição que sai na nota<input name="description" /></label>
            <div style={{ gridColumn: "1/-1" }}><button className="btn primary">Salvar</button></div>
          </form>
        </details>
      )}
      <section className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead><tr><th>Nome</th><th>Cód. serviço</th><th>Cód. municipal</th><th>CNAE</th><th>ISS</th><th>Situação</th>{editar && <th></th>}</tr></thead>
          <tbody>
            {lista.map((t) => (
              <tr key={t.id}>
                <td><b>{t.name}</b>{t.description && <div className="muted" style={{ fontSize: 12 }}>{t.description}</div>}</td>
                <td>{t.service_code ?? "—"}</td><td>{t.municipal_code ?? "—"}</td><td>{t.cnae ?? "—"}</td>
                <td>{Number(t.iss_rate).toLocaleString("pt-BR")}%{t.iss_withheld ? " (retido)" : ""}</td>
                <td><span className={t.active ? "badge" : "badge warn"}>{t.active ? "Ativo" : "Inativo"}</span></td>
                {editar && (
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <form action={alternar}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="ativar" value={t.active ? "0" : "1"} /><button className="btn secondary">{t.active ? "Desativar" : "Ativar"}</button></form>
                      <form action={excluir}><input type="hidden" name="id" value={t.id} /><button className="btn secondary" title="Excluir">🗑</button></form>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={7} className="muted">Nenhum tipo de serviço cadastrado ainda.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
