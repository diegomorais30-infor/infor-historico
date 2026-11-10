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
  const { data, error } = await supabase.from("catalog_services").insert({ name, description: String(formData.get("description") || "").trim() || null }).select("id").single();
  if (error || !data) redirect("/servicos?erro=" + encodeURIComponent(error?.message ?? "Erro ao criar."));
  const preco = num(formData.get("price"));
  if (preco > 0) await supabase.from("service_prices").upsert({ service_id: data.id, price: preco }, { onConflict: "service_id" });
  revalidatePath("/servicos");
  redirect("/servicos");
}

async function salvarServico(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/servicos?erro=" + encodeURIComponent("Informe o nome do serviço."));
  const { error } = await supabase.from("catalog_services").update({ name, description: String(formData.get("description") || "").trim() || null }).eq("id", id);
  if (error) redirect("/servicos?erro=" + encodeURIComponent(error.message));
  if (formData.has("price")) await supabase.from("service_prices").upsert({ service_id: id, price: num(formData.get("price")) }, { onConflict: "service_id" });
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

export default async function Servicos({ searchParams }: { searchParams: Promise<{ erro?: string; q?: string; editar?: string }> }) {
  const { erro, q, editar: editando } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const perms = (perfil as any)?.permissions;
  const editar = podeEditar(perfil?.role, perms, "os");
  const verFin = podeVer(perfil?.role, perms, "financeiro");
  const editFin = podeEditar(perfil?.role, perms, "financeiro");
  const { data } = await supabase.from("catalog_services").select("id, name, description, legacy_ref").eq("active", true).order("created_at", { ascending: false });
  const precos: Record<string, number> = {};
  if (verFin) {
    const { data: pr } = await supabase.from("service_prices").select("service_id, price");
    for (const r of pr ?? []) precos[(r as any).service_id] = Number((r as any).price);
  }
  const busca = (q ?? "").trim().toLowerCase();
  const lista: any[] = (data ?? [])
    .map((x: any, i: number, a: any[]) => ({ ...x, num: x.legacy_ref ? Number(x.legacy_ref) : 0 }))
    .sort((a: any, b: any) => b.num - a.num)
    .filter((x: any) => !busca || `${x.name} ${x.description ?? ""} ${x.num}`.toLowerCase().includes(busca));

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
          <label className="field">
            Descrição
            <input name="description" />
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
      <form method="get" className="inline" style={{ marginBottom: 12 }}>
        <input name="q" defaultValue={q ?? ""} placeholder="Buscar" aria-label="Buscar" />
        <button className="btn secondary">Buscar</button>
      </form>
      <section className="card">
        <ConfigTabela chave="servicos" />
        <p className="muted" style={{ textAlign: "right", margin: 0 }}>Serviços: {lista.length}</p>
<table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Serviço</th>
              {verFin && <th>Preço</th>}
              <th>Descrição</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((s) =>
              editando === s.id && editar ? (
                <tr key={s.id}>
                  <td colSpan={5}>
                    <form action={salvarServico} className="grid g4">
                      <input type="hidden" name="id" value={s.id} />
                      <label className="field">Serviço<input name="name" defaultValue={s.name} required /></label>
                      {editFin && <label className="field">Preço<input name="price" inputMode="decimal" defaultValue={precos[s.id] ?? 0} /></label>}
                      <label className="field">Descrição<input name="description" defaultValue={s.description ?? ""} /></label>
                      <div style={{ alignSelf: "end", display: "flex", gap: 8 }}>
                        <button className="btn primary">Salvar</button>
                        <a className="btn secondary" href="/servicos">Cancelar</a>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={s.id}>
                  <td>{s.num || "—"}</td>
                  <td>{s.name}</td>
                  {verFin && <td>{moeda(precos[s.id])}</td>}
                  <td className="muted">{s.description ?? ""}</td>
                  <td>
                    {editar && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <a className="btn secondary" href={`/servicos?editar=${s.id}`}>✏️ Editar</a>
                        <form action={desativar}>
                          <input type="hidden" name="id" value={s.id} />
                          <button className="btn secondary">Remover</button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              )
            )}
            {!lista.length && (
              <tr>
                <td colSpan={5} className="muted">Nenhum serviço encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
