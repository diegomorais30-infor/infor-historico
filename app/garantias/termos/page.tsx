import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { podeEditar } from "@/lib/permissoes";

async function salvar(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id") || "");
  const name = String(fd.get("name") || "").trim();
  if (!name) redirect("/garantias/termos?erro=" + encodeURIComponent("Informe o nome do termo."));
  const dados = { name, days: Number(fd.get("days")) || null, body: String(fd.get("body") || "").trim() || null };
  const { error } = id ? await supabase.from("warranty_terms").update(dados).eq("id", id) : await supabase.from("warranty_terms").insert(dados);
  if (error) redirect("/garantias/termos?erro=" + encodeURIComponent(error.message));
  revalidatePath("/garantias/termos");
  redirect("/garantias/termos?ok=1");
}

async function excluir(fd: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("warranty_terms").delete().eq("id", String(fd.get("id")));
  revalidatePath("/garantias/termos");
  redirect("/garantias/termos");
}

export default async function Termos({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string; editar?: string }> }) {
  const { erro, ok, editar: ed } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const editar = podeEditar(perfil?.role, (perfil as any)?.permissions, "os");
  const { data } = await supabase.from("warranty_terms").select("*").order("name");
  const termos: any[] = data ?? [];
  const atual = termos.find((t) => t.id === ed);

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="title">Termos de garantia</h1>
          <div className="muted">Textos de entrada e saída usados nas OS e o prazo de garantia em dias</div>
        </div>
        <Link className="btn secondary" href="/garantias">← Garantias</Link>
      </div>
      {erro && <div className="error" style={{ marginBottom: 10 }}>{erro}</div>}
      {ok && <div className="os-ok">Salvo.</div>}
      <section className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead><tr><th>Termo</th><th>Prazo (dias)</th><th>Texto</th><th>Ações</th></tr></thead>
          <tbody>
            {termos.map((t) => (
              <tr key={t.id}>
                <td><b>{t.name}</b></td>
                <td>{t.days ?? "—"}</td>
                <td style={{ maxWidth: 520 }}>{String(t.body ?? "").slice(0, 220)}{String(t.body ?? "").length > 220 ? "…" : ""}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {editar && <Link className="btn primary" href={`/garantias/termos?editar=${t.id}`}>✎</Link>}{" "}
                  {editar && <form action={excluir} style={{ display: "inline" }}><input type="hidden" name="id" value={t.id} /><button className="btn secondary">Excluir</button></form>}
                </td>
              </tr>
            ))}
            {!termos.length && <tr><td colSpan={4} className="muted" style={{ textAlign: "center" }}>Nenhum termo cadastrado.</td></tr>}
          </tbody>
        </table>
      </section>
      {editar && (
        <form action={salvar} className="card grid g2" style={{ marginTop: 14 }}>
          <h2 style={{ gridColumn: "1/-1", margin: 0 }}>{atual ? `Editar: ${atual.name}` : "Novo termo"}</h2>
          <input type="hidden" name="id" value={atual?.id ?? ""} />
          <label className="field">Nome (aparece no campo Termo da OS)<input name="name" defaultValue={atual?.name ?? ""} required /></label>
          <label className="field">Prazo de garantia (dias)<input name="days" inputMode="numeric" defaultValue={atual?.days ?? ""} placeholder="Ex.: 90" /></label>
          <label className="field" style={{ gridColumn: "1/-1" }}>Texto do termo<textarea name="body" rows={8} defaultValue={atual?.body ?? ""} /></label>
          <div style={{ gridColumn: "1/-1", display: "flex", gap: 8 }}>
            <button className="btn primary">Salvar</button>
            {atual && <Link className="btn secondary" href="/garantias/termos">Cancelar</Link>}
          </div>
        </form>
      )}
    </main>
  );
}
