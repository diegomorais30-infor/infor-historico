import { redirect } from "next/navigation";
import ConfigTabela from "@/components/config-tabela";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { moeda } from "@/lib/format";
import { podeEditar, podeVer } from "@/lib/permissoes";

const num = (v: FormDataEntryValue | null) => Number(String(v || "0").replace(",", ".")) || 0;

async function criar(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/servicos?erro=" + encodeURIComponent("Informe o nome do serviço."));
  const { data, error } = await supabase.from("catalog_services").insert({ name }).select("id").single();
  if (error || !data) redirect("/servicos?erro=" + encodeURIComponent(error?.message ?? "Erro ao criar."));
  const preco = num(formData.get("price"));
  if (preco > 0) await supabase.from("service_prices").upsert({ service_id: data.id, price: preco }, { onConflict: "service_id" });
  revalidatePath("/servicos");
  redirect("/servicos");
}

async function salvarPreco(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_prices")
    .upsert({ service_id: String(formData.get("id")), price: num(formData.get("price")) }, { onConflict: "service_id" });
  if (error) redirect("/servicos?erro=" + encodeURIComponent(error.message));
  revalidatePath("/servicos");
  redirect("/servicos");
}

async function desativar(formData: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("catalog_services").update({ active: false }).eq("id", String(formData.get("id")));
  revalidatePath("/servicos");
  redirect("/servicos");
}

export default async function Servicos({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const perms = (perfil as any)?.permissions;
  const editar = podeEditar(perfil?.role, perms, "os");
  const verFin = podeVer(perfil?.role, perms, "financeiro");
  const editFin = podeEditar(perfil?.role, perms, "financeiro");
  const { data } = await supabase.from("catalog_services").select("id, name").eq("active", true).order("name");
  const precos: Record<string, number> = {};
  if (verFin) {
    const { data: pr } = await supabase.from("service_prices").select("service_id, price");
    for (const r of pr ?? []) precos[(r as any).service_id] = Number((r as any).price);
  }
  const lista: any[] = data ?? [];

  return (
    <main className="wrap">
      <h1 className="title">Serviços</h1>
      <p className="muted">Catálogo usado nas ordens de serviço. {verFin ? "O valor entra sozinho ao escolher o serviço na OS." : ""}</p>
      {erro && <div className="error" style={{ margin: "14px 0" }}>{erro}</div>}
      {editar && (
        <form action={criar} className="card grid g3" style={{ margin: "18px 0" }}>
          <label className="field">
            Nome do serviço
            <input name="name" required />
          </label>
          {editFin && (
            <label className="field">
              Valor (R$)
              <input name="price" inputMode="decimal" defaultValue="0" />
            </label>
          )}
          <div style={{ alignSelf: "end" }}>
            <button className="btn primary">Cadastrar serviço</button>
          </div>
        </form>
      )}
      <section className="card">
        <ConfigTabela chave="servicos" />
<table className="table">
          <thead>
            <tr>
              <th>Serviço</th>
              {verFin && <th>Valor</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                {verFin && (
                  <td>
                    {editFin ? (
                      <form action={salvarPreco} className="inline">
                        <input type="hidden" name="id" value={s.id} />
                        <input name="price" inputMode="decimal" defaultValue={precos[s.id] ?? 0} style={{ width: 100 }} aria-label="Valor" />
                        <button className="btn secondary">Salvar</button>
                      </form>
                    ) : (
                      moeda(precos[s.id])
                    )}
                  </td>
                )}
                <td>
                  {editar && (
                    <form action={desativar}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="btn secondary">Remover</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!lista.length && (
              <tr>
                <td colSpan={3} className="muted">Nenhum serviço cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
