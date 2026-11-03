import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { PERFIS, fmtData } from "@/lib/format";

async function convidar(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "technician");
  if (!email.includes("@")) redirect("/usuarios?erro=" + encodeURIComponent("Informe um e-mail válido."));
  if (!["admin", "manager", "technician"].includes(role)) redirect("/usuarios?erro=Perfil%20inv%C3%A1lido");

  // company_id e a permissão de admin são conferidos pelo banco
  const { error } = await supabase.from("company_invites").insert({ email, role, created_by: user.id });
  if (error) redirect("/usuarios?erro=" + encodeURIComponent(error.message));
  revalidatePath("/usuarios");
  redirect("/usuarios");
}

async function alterarPerfil(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) redirect("/usuarios?erro=" + encodeURIComponent(error.message));
  revalidatePath("/usuarios");
  redirect("/usuarios");
}

async function alternarAtivo(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const ativo = formData.get("ativo") === "true";
  const { error } = await supabase.from("profiles").update({ active: ativo }).eq("id", id);
  if (error) redirect("/usuarios?erro=" + encodeURIComponent(error.message));
  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export default async function Usuarios({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const { supabase, user, perfil } = await getContexto();
  if (perfil?.role !== "admin") redirect("/dashboard");

  const { data: perfis } = await supabase.from("profiles").select("id, full_name, role, active").order("full_name");
  const { data: convites } = await supabase
    .from("company_invites")
    .select("id, email, role, accepted_at, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="wrap">
      <h1 className="title">Usuários</h1>
      <p className="muted">Convide sua equipe. Cada pessoa cria a conta em /cadastro usando o e-mail convidado.</p>

      {erro && (
        <div className="error" style={{ margin: "14px 0" }}>
          {erro}
        </div>
      )}

      <form action={convidar} className="card grid g4" style={{ margin: "18px 0" }}>
        <label className="field" style={{ gridColumn: "span 2" }}>
          E-mail do convidado
          <input name="email" type="email" required />
        </label>
        <label className="field">
          Perfil
          <select name="role" defaultValue="technician">
            {Object.entries(PERFIS).map(([valor, nome]) => (
              <option key={valor} value={valor}>
                {nome}
              </option>
            ))}
          </select>
        </label>
        <div style={{ alignSelf: "end" }}>
          <button className="btn primary">Enviar convite</button>
        </div>
      </form>

      <section className="card">
        <h2>Equipe</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Perfil</th>
              <th>Situação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(perfis ?? []).map((p: any) => (
              <tr key={p.id}>
                <td>{p.full_name || "Sem nome"}</td>
                <td>
                  {p.id === user.id ? (
                    PERFIS[p.role]
                  ) : (
                    <form action={alterarPerfil} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <select name="role" defaultValue={p.role}>
                        {Object.entries(PERFIS).map(([valor, nome]) => (
                          <option key={valor} value={valor}>
                            {nome}
                          </option>
                        ))}
                      </select>
                      <button className="btn secondary">Salvar</button>
                    </form>
                  )}
                </td>
                <td>
                  <span className={p.active ? "badge" : "badge warn"}>{p.active ? "Ativo" : "Desativado"}</span>
                </td>
                <td>
                  {p.id !== user.id && (
                    <form action={alternarAtivo}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="ativo" value={p.active ? "false" : "true"} />
                      <button className="btn secondary">{p.active ? "Desativar" : "Reativar"}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Convites</h2>
        <table className="table">
          <thead>
            <tr>
              <th>E-mail</th>
              <th>Perfil</th>
              <th>Enviado em</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {(convites ?? []).map((c: any) => (
              <tr key={c.id}>
                <td>{c.email}</td>
                <td>{PERFIS[c.role]}</td>
                <td>{fmtData(c.created_at)}</td>
                <td>{c.accepted_at ? "Aceito" : "Aguardando"}</td>
              </tr>
            ))}
            {!(convites ?? []).length && (
              <tr>
                <td colSpan={4} className="muted">
                  Nenhum convite enviado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
