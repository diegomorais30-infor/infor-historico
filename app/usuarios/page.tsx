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

export default async function Usuarios({ searchParams }: { searchParams: Promise<{ erro?: string; email?: string }> }) {
  const { erro, email: statusEmail } = await searchParams;
  const { supabase, user, perfil } = await getContexto();
  if (perfil?.role !== "admin") redirect("/dashboard");

  const { data: perfis } = await supabase.from("profiles").select("id, full_name, role, active").order("full_name");
  const { data: convites } = await supabase
    .from("company_invites")
    .select("id, email, role, accepted_at, created_at")
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
