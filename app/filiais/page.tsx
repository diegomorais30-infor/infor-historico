import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";

async function salvar(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id") || "");
  const name = String(fd.get("name") || "").trim();
  if (!name) redirect("/filiais?erro=" + encodeURIComponent("Informe o nome da filial."));
  const dados = { name, address: String(fd.get("address") || "").trim() || null, city: String(fd.get("city") || "").trim() || null };
  const { error } = id ? await supabase.from("branches").update(dados).eq("id", id) : await supabase.from("branches").insert(dados);
  if (error) redirect("/filiais?erro=" + encodeURIComponent("Só o administrador altera filiais. " + error.message));
  revalidatePath("/filiais");
  redirect("/filiais?ok=1");
}

async function excluir(fd: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("branches").delete().eq("id", String(fd.get("id")));
  revalidatePath("/filiais");
  redirect("/filiais");
}

export default async function Filiais({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string; editar?: string; q?: string }> }) {
  const { erro, ok, editar, q } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const admin = perfil?.role === "admin";
  const { data } = await supabase.from("branches").select("*").order("created_at");
  const t = (q ?? "").toLowerCase();
  const lista: any[] = (data ?? []).filter((b: any) => !t || [b.name, b.city, b.address].filter(Boolean).some((x: string) => x.toLowerCase().includes(t)));
  const atual = (data ?? []).find((b: any) => b.id === editar);

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 12 }}>
        <div><h1 className="title">Filiais</h1><div className="muted">Unidades da empresa, com o endereço de cada uma</div></div>
        <form style={{ display: "flex", gap: 6 }}><input name="q" defaultValue={q ?? ""} placeholder="Buscar" /><button className="btn secondary">Buscar</button></form>
      </div>
      {erro && <div className="error" style={{ marginBottom: 10 }}>{erro}</div>}
      {ok && <div className="os-ok">Salvo.</div>}
      <section className="card">
        <table className="table">
          <thead><tr><th>#</th><th>Nome</th><th>Endereço</th><th>Cidade</th><th>Ações</th></tr></thead>
          <tbody>
            {lista.map((b, i) => (
              <tr key={b.id}>
                <td>{i + 1}</td><td><b>{b.name}</b></td><td>{b.address ?? "—"}</td><td>{b.city ?? "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {admin && <Link className="btn primary" href={`/filiais?editar=${b.id}`}>✎</Link>}{" "}
                  {admin && <form action={excluir} style={{ display: "inline" }}><input type="hidden" name="id" value={b.id} /><button className="btn secondary">Excluir</button></form>}
                </td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={5} className="muted" style={{ textAlign: "center" }}>Nenhuma filial cadastrada.</td></tr>}
          </tbody>
        </table>
      </section>
      {admin && (
        <form action={salvar} className="card grid g2" style={{ marginTop: 14 }}>
          <h2 style={{ gridColumn: "1/-1", margin: 0 }}>{atual ? `Editar: ${atual.name}` : "Nova filial"}</h2>
          <input type="hidden" name="id" value={atual?.id ?? ""} />
          <label className="field">Nome<input name="name" defaultValue={atual?.name ?? ""} required /></label>
          <label className="field">Cidade<input name="city" defaultValue={atual?.city ?? ""} /></label>
          <label className="field" style={{ gridColumn: "1/-1" }}>Endereço<input name="address" defaultValue={atual?.address ?? ""} /></label>
          <div style={{ gridColumn: "1/-1", display: "flex", gap: 8 }}><button className="btn primary">Salvar</button>{atual && <Link className="btn secondary" href="/filiais">Cancelar</Link>}</div>
        </form>
      )}
    </main>
  );
}
