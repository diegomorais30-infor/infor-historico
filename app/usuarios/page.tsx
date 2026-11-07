import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { PERFIS, fmtData } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerPermissoes } from "@/lib/permissoes";
import PermissoesCampos from "@/components/permissoes-campos";

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
  const { error } = await supabase.from("company_invites").insert({ email, role, permissions: lerPermissoes(formData), created_by: user.id });
  if (error) redirect("/usuarios?erro=" + encodeURIComponent(error.message));

  // E-mail do convite (só se o Resend estiver configurado); falha no envio não desfaz o convite
  let aviso = "";
  const chave = process.env.RESEND_API_KEY;
  if (chave) {
    const { data: p } = await supabase.from("profiles").select("companies(name)").eq("id", user.id).single();
    const empresa = (p as any)?.companies?.name ?? "sua empresa";
    const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://inforgest.com.br").replace(/\/$/, "");
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "InforGest <convites@inforgest.com.br>",
          to: [email],
          subject: `Convite para o InforGest — ${empresa}`,
          html:
            `<p>Olá! Você foi convidado para o InforGest da <b>${esc(empresa)}</b>.</p>` +
            `<p>1) Abra <a href="${site}/cadastro">${site}/cadastro</a><br>2) Crie sua conta usando exatamente este e-mail: <b>${esc(email)}</b></p>`,
        }),
      });
      if (r.ok) aviso = "ok";
      else {
        const corpo = await r.text();
        console.error("Resend falhou", r.status, corpo);
        aviso = "falha:" + r.status + " " + corpo.slice(0, 180);
      }
    } catch (e) {
      console.error("Resend erro", e);
      aviso = "falha:" + String((e as Error)?.message ?? e).slice(0, 180);
    }
  }
  revalidatePath("/usuarios");
  redirect("/usuarios" + (aviso ? `?email=${encodeURIComponent(aviso)}` : ""));
}

async function atualizarMeuNome(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const nome = String(formData.get("full_name") || "").trim().replace(/\s+/g, " ");
  if (nome.length < 2 || nome.length > 80) redirect("/usuarios?erro=" + encodeURIComponent("Informe seu nome completo."));

  const { error } = await supabase.from("profiles").update({ full_name: nome }).eq("id", user.id);
  if (error) redirect("/usuarios?erro=" + encodeURIComponent(error.message));
  revalidatePath("/", "layout");
  redirect("/usuarios");
}

async function atualizarEmpresa(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: eu } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  const nome = String(formData.get("name") || "").trim();
  if (nome.length < 2) redirect("/usuarios?erro=" + encodeURIComponent("Informe o nome da empresa."));

  // WhatsApp: só números, com o 55 do Brasil na frente
  let zap = String(formData.get("whatsapp") || "").replace(/\D/g, "");
  if (zap && zap.length <= 11) zap = `55${zap}`;
  if (zap && (zap.length < 12 || zap.length > 13)) {
    redirect("/usuarios?erro=" + encodeURIComponent("WhatsApp inválido. Use DDD + número."));
  }

  const { error } = await supabase
    .from("companies")
    .update({ name: nome, whatsapp: zap || null })
    .eq("id", eu?.company_id);
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

async function alterarConvite(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));
  if (!["admin", "manager", "technician"].includes(role)) redirect("/usuarios?erro=Perfil%20inv%C3%A1lido");
  const { error } = await supabase.from("company_invites").update({ role, permissions: lerPermissoes(formData) }).eq("id", id).is("accepted_at", null);
  if (error) redirect("/usuarios?erro=" + encodeURIComponent(error.message));
  revalidatePath("/usuarios");
  redirect("/usuarios");
}

async function cancelarConvite(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("company_invites").delete().eq("id", id).is("accepted_at", null);
  if (error) redirect("/usuarios?erro=" + encodeURIComponent(error.message));
  revalidatePath("/usuarios");
  redirect("/usuarios");
}

async function atualizarPermissoes(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("profiles").update({ permissions: lerPermissoes(formData) }).eq("id", id);
  if (error) redirect("/usuarios?erro=" + encodeURIComponent(error.message));
  revalidatePath("/usuarios");
  redirect("/usuarios?ok=" + encodeURIComponent("Permissões salvas."));
}

async function criarConta(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const nome = String(formData.get("full_name") || "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const senha = String(formData.get("senha") || "");
  const role = String(formData.get("role") || "technician");
  const falha = (m: string) => redirect("/usuarios?erro=" + encodeURIComponent(m));
  if (nome.length < 2) falha("Informe o nome da pessoa.");
  if (!email.includes("@")) falha("Informe um e-mail válido.");
  if (senha.length < 8) falha("A senha provisória precisa ter pelo menos 8 caracteres.");
  if (!["admin", "manager", "technician"].includes(role)) falha("Perfil inválido.");

  // Convite (confere que quem pede é administrador, pelas regras do banco) e depois a conta
  const { data: convite, error: e1 } = await supabase
    .from("company_invites")
    .insert({ email, role, permissions: lerPermissoes(formData), created_by: user.id })
    .select("id")
    .single();
  if (e1 || !convite) falha(e1?.message ?? "Não foi possível criar o convite.");

  let erroConta = "";
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { full_name: nome, must_change_password: true },
    });
    if (error) erroConta = error.message;
  } catch (e) {
    erroConta = String((e as Error)?.message ?? e);
  }
  if (erroConta) {
    await supabase.from("company_invites").delete().eq("id", convite!.id).is("accepted_at", null);
    falha("Não foi possível criar a conta: " + erroConta);
  }
  revalidatePath("/usuarios");
  redirect("/usuarios?ok=" + encodeURIComponent(`Conta criada para ${email}. Passe a senha provisória a ela; no primeiro acesso será pedida uma senha nova.`));
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

export default async function Usuarios({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string; email?: string }> }) {
  const { erro, ok, email: statusEmail } = await searchParams;
  const { supabase, user, perfil } = await getContexto();
  if (perfil?.role !== "admin") redirect("/dashboard");

  const { data: perfis } = await supabase.from("profiles").select("id, full_name, role, active, permissions").order("full_name");
  const { data: convites } = await supabase
    .from("company_invites")
    .select("id, email, role, permissions, accepted_at, created_at")
    .order("created_at", { ascending: false });

  // Convite por WhatsApp: abre o WhatsApp com a mensagem pronta; você escolhe o contato.
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://inforgest.com.br").replace(/\/$/, "");
  const nomeEmpresa = (perfil as any)?.companies?.name ?? "nossa empresa";
  const linkWhatsapp = (email: string, role: string) => {
    const texto =
      `Olá! Você foi convidado para o InforGest da ${nomeEmpresa} como ${PERFIS[role] ?? role}.\n\n` +
      `1) Abra ${site}/cadastro\n` +
      `2) Crie sua conta usando exatamente este e-mail: ${email}`;
    return `https://wa.me/?text=${encodeURIComponent(texto)}`;
  };

  return (
    <main className="wrap">
      <h1 className="title">Usuários</h1>
      <p className="muted">Convide sua equipe. Cada pessoa cria a conta em /cadastro usando o e-mail convidado.</p>

      {statusEmail === "ok" && <div className="card" style={{ margin: "14px 0" }}>Convite enviado por e-mail.</div>}
      {statusEmail?.startsWith("falha") && (
        <div className="error" style={{ margin: "14px 0" }}>
          Convite criado, mas o e-mail não saiu. Use o botão "Enviar por WhatsApp" abaixo.{statusEmail.length > 5 && <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>Detalhe: {statusEmail.slice(6)}</div>}
        </div>
      )}
      {ok && <div className="card" style={{ margin: "14px 0" }}>{ok}</div>}
      {erro && (
        <div className="error" style={{ margin: "14px 0" }}>
          {erro}
        </div>
      )}

      <form action={atualizarMeuNome} className="card" style={{ margin: "18px 0", display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
        <label className="field" style={{ flex: "1 1 240px" }}>
          Seu nome
          <input name="full_name" required minLength={2} maxLength={80} defaultValue={perfil?.full_name ?? ""} />
        </label>
        <button className="btn primary">Salvar meu nome</button>
      </form>

      <form action={atualizarEmpresa} className="card grid g4" style={{ margin: "18px 0" }}>
        <label className="field" style={{ gridColumn: "span 2" }}>
          Nome da empresa
          <input name="name" required defaultValue={(perfil as any)?.companies?.name ?? ""} />
        </label>
        <label className="field">
          WhatsApp de atendimento
          <input
            name="whatsapp"
            inputMode="tel"
            placeholder="(38) 3213-4000"
            defaultValue={(perfil as any)?.companies?.whatsapp ?? ""}
          />
        </label>
        <div style={{ alignSelf: "end" }}>
          <button className="btn primary">Salvar empresa</button>
        </div>
        <p className="muted" style={{ gridColumn: "1/-1", margin: 0, fontSize: 13 }}>
          Este WhatsApp aparece na página do QR code para os clientes pedirem manutenção.
        </p>
      </form>

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
        <details style={{ gridColumn: "1/-1" }}>
          <summary className="muted">Permissões por área (opcional)</summary>
          <div style={{ marginTop: 10 }}>
            <PermissoesCampos />
          </div>
        </details>
      </form>

      <form action={criarConta} className="card grid g4" style={{ margin: "18px 0" }}>
        <h2 style={{ gridColumn: "1/-1", margin: 0 }}>Criar conta com senha provisória</h2>
        <p className="muted" style={{ gridColumn: "1/-1", margin: 0, fontSize: 13 }}>
          A conta já fica pronta. Você passa a senha provisória à pessoa e, no primeiro acesso, o sistema pede uma senha nova.
        </p>
        <label className="field">
          Nome
          <input name="full_name" required minLength={2} maxLength={80} />
        </label>
        <label className="field">
          E-mail
          <input name="email" type="email" required />
        </label>
        <label className="field">
          Senha provisória
          <input name="senha" type="text" required minLength={8} autoComplete="off" />
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
        <details style={{ gridColumn: "1/-1" }}>
          <summary className="muted">Permissões por área (opcional)</summary>
          <div style={{ marginTop: 10 }}>
            <PermissoesCampos />
          </div>
        </details>
        <div style={{ gridColumn: "1/-1" }}>
          <button className="btn primary">Criar conta</button>
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
                  {p.role !== "admin" && (
                    <details style={{ marginTop: 8 }}>
                      <summary className="muted">Permissões</summary>
                      <form action={atualizarPermissoes} style={{ marginTop: 8 }}>
                        <input type="hidden" name="id" value={p.id} />
                        <PermissoesCampos atuais={p.permissions} />
                        <button className="btn secondary" style={{ marginTop: 8 }}>Salvar permissões</button>
                      </form>
                    </details>
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
                <td>
                  {c.email}
                  {!c.accepted_at && (
                    <div style={{ marginTop: 6 }}>
                      <a className="btn secondary" href={linkWhatsapp(c.email, c.role)} target="_blank" rel="noopener noreferrer">
                        Enviar por WhatsApp
                      </a>
                    </div>
                  )}
                </td>
                <td>
                  {c.accepted_at ? (
                    PERFIS[c.role]
                  ) : (
                    <form action={alterarConvite} className="inline">
                      <input type="hidden" name="id" value={c.id} />
                      <select name="role" defaultValue={c.role}>
                        {Object.entries(PERFIS).map(([valor, nome]) => (
                          <option key={valor} value={valor}>
                            {nome}
                          </option>
                        ))}
                      </select>
                      <details style={{ marginTop: 8 }}>
                        <summary className="muted">Permissões</summary>
                        <div style={{ marginTop: 8 }}>
                          <PermissoesCampos atuais={c.permissions} />
                        </div>
                      </details>
                      <button className="btn secondary" style={{ marginTop: 8 }}>Salvar</button>
                    </form>
                  )}
                </td>
                <td>{fmtData(c.created_at)}</td>
                <td>
                  {c.accepted_at ? (
                    "Aceito"
                  ) : (
                    <>
                      <div>Aguardando</div>
                      <form action={cancelarConvite} style={{ marginTop: 6 }}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="btn secondary">Cancelar convite</button>
                      </form>
                    </>
                  )}
                </td>
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
