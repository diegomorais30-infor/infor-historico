import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";

const ESCOPOS: Record<string, string> = {
  os: "Ordens de Serviço", clientes: "Clientes", equipamentos: "Equipamentos", produtos: "Produtos", vendas: "Vendas",
};

async function salvar(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id") || "");
  const name = String(fd.get("name") || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!name) redirect("/tags?erro=" + encodeURIComponent("Informe o nome da tag."));
  const dados = {
    name,
    note: String(fd.get("note") || "").trim() || null,
    color: String(fd.get("color") || "#6b7280"),
    scope: String(fd.get("scope") || "os"),
  };
  const { error } = id ? await supabase.from("tags").update(dados).eq("id", id) : await supabase.from("tags").insert(dados);
  if (error) redirect("/tags?erro=" + encodeURIComponent(error.code === "23505" ? "Já existe uma tag com esse nome." : error.message));
  revalidatePath("/tags");
  redirect("/tags");
}

async function excluir(fd: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("tags").delete().eq("id", String(fd.get("id")));
  revalidatePath("/tags");
  redirect("/tags");
}

export default async function Tags({ searchParams }: { searchParams: Promise<{ q?: string; v?: string; editar?: string; erro?: string }> }) {
  const { q, v, editar, erro } = await searchParams;
  const { supabase } = await getContexto();
  let qb = supabase.from("tags").select("id, name, note, color, scope").order("name").limit(1000);
  if (v && ESCOPOS[v]) qb = qb.eq("scope", v);
  if (q?.trim()) qb = qb.or(`name.ilike.%${q.trim().replace(/[%,]/g, "")}%,note.ilike.%${q.trim().replace(/[%,]/g, "")}%`);
  const { data } = await qb;
  const tags = (data ?? []) as any[];
  const ed = tags.find((t) => t.id === editar);

  return (
    <main className="wrap">
      <h1 className="title">Tags</h1>
      <p className="muted">Etiquetas para organizar OS, clientes, equipamentos, produtos e vendas</p>
      {erro && <div className="error" style={{ margin: "10px 0" }}>{erro}</div>}
      <form action={salvar} className="card grid g4" style={{ margin: "12px 0" }} key={ed?.id ?? "nova"}>
        <input type="hidden" name="id" value={ed?.id ?? ""} />
        <label className="field">Nome<input name="name" required defaultValue={ed?.name ?? ""} /></label>
        <label className="field">Descrição<input name="note" defaultValue={ed?.note ?? ""} /></label>
        <label className="field">Vínculo
          <select name="scope" defaultValue={ed?.scope ?? "os"}>
            {Object.entries(ESCOPOS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </label>
        <label className="field">Cor<input type="color" name="color" defaultValue={ed?.color ?? "#6b7280"} /></label>
        <div style={{ alignSelf: "end" }}>
          <button className="btn primary">{ed ? "Salvar tag" : "+ Nova tag"}</button>
          {ed && <Link href="/tags" className="btn secondary" style={{ marginLeft: 8 }}>Cancelar</Link>}
        </div>
      </form>
      <section className="card" style={{ overflowX: "auto" }}>
        <form method="get" className="inline" style={{ marginBottom: 10 }}>
          <input name="q" defaultValue={q ?? ""} placeholder="Buscar" aria-label="Buscar" />
          <select name="v" defaultValue={v ?? ""} aria-label="Vínculo">
            <option value="">Todos os vínculos</option>
            {Object.entries(ESCOPOS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
          <button className="btn secondary">Filtrar</button>
        </form>
        <p className="muted" style={{ textAlign: "right", margin: 0 }}>{tags.length} tags</p>
        <table className="table">
          <thead><tr><th>Descrição</th><th>Cor</th><th>Vínculo</th><th>Ações</th></tr></thead>
          <tbody>
            {tags.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.name}</strong>{t.note ? <span className="muted"> → {t.note}</span> : null}</td>
                <td><span style={{ display: "inline-block", width: 18, height: 18, borderRadius: 4, background: t.color, verticalAlign: "middle" }} /></td>
                <td>{ESCOPOS[t.scope] ?? t.scope}</td>
                <td>
                  <Link href={`/tags?editar=${t.id}`} className="btn secondary">Editar</Link>{" "}
                  <form action={excluir} style={{ display: "inline" }}><input type="hidden" name="id" value={t.id} /><button className="btn secondary">Excluir</button></form>
                </td>
              </tr>
            ))}
            {!tags.length && <tr><td colSpan={4} className="muted">Nenhuma tag.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
