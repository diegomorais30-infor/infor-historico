import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { redirect } from "next/navigation";
import { podeEditar, podeVer } from "@/lib/permissoes";

export const metadata = { title: "Fornecedores" };

export default async function Fornecedores({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const papel = (perfil as any)?.role;
  const perms = (perfil as any)?.permissions;
  if (!podeVer(papel, perms, "financeiro")) redirect("/dashboard");
  const edita = podeEditar(papel, perms, "financeiro");

  async function criar(fd: FormData) {
    "use server";
    const { supabase } = await getContexto();
    const name = String(fd.get("name") || "").trim();
    if (!name) return;
    const v = (k: string) => String(fd.get(k) || "").trim() || null;
    await supabase.from("suppliers").insert({
      name, document: v("document"), phone: v("phone"), email: v("email"), category: v("category"), notes: v("notes"),
    });
    revalidatePath("/fornecedores");
  }
  async function excluir(fd: FormData) {
    "use server";
    const { supabase } = await getContexto();
    await supabase.from("suppliers").delete().eq("id", String(fd.get("id")));
    revalidatePath("/fornecedores");
  }

  let query = supabase.from("suppliers").select("*").order("category", { nullsFirst: false }).order("name");
  if (q) query = query.ilike("name", `%${q}%`);
  const { data } = await query;
  const lista: any[] = data ?? [];

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="title">Fornecedores</h1>
          <p className="muted">Quem a empresa paga: fornecedores, impostos, contas fixas, folha e bancos.</p>
        </div>
      </div>

      <form className="card" style={{ marginBottom: 14, display: "flex", gap: 8 }}>
        <input name="q" defaultValue={q} placeholder="Buscar fornecedor" style={{ flex: 1 }} />
        <button className="btn secondary">Buscar</button>
      </form>

      {edita && (
        <form action={criar} className="card grid" style={{ gap: 10, marginBottom: 14 }}>
          <b>Novo fornecedor</b>
          <input name="name" required placeholder="Nome / razão social" />
          <input name="category" placeholder="Categoria (ex.: Impostos, Contas fixas, Peças)" />
          <input name="document" placeholder="CNPJ / CPF" />
          <input name="phone" placeholder="Telefone" />
          <input name="email" placeholder="E-mail" />
          <input name="notes" placeholder="Observações" />
          <button className="btn primary">Cadastrar</button>
        </form>
      )}

      <section className="card">
        <table className="table">
          <thead>
            <tr><th>Fornecedor</th><th>Categoria</th><th>Telefone</th><th></th></tr>
          </thead>
          <tbody>
            {lista.map((f) => (
              <tr key={f.id}>
                <td>{f.name}</td>
                <td>{f.category || "-"}</td>
                <td>{f.phone || "-"}</td>
                <td>
                  {edita && (
                    <form action={excluir}>
                      <input type="hidden" name="id" value={f.id} />
                      <button className="btn secondary">Excluir</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={4} className="muted">Nenhum fornecedor.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
