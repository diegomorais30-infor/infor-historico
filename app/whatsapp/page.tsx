import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import type { ReactNode } from "react";
import { enviarModelo, segredosOk } from "@/lib/whatsapp-cloud";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://inforgest.com.br";
const EVENTOS: [string, string][] = [["os_criada", "OS aberta"], ["os_pronta", "OS pronta"], ["orcamento", "Orçamento"], ["cobranca", "Cobrança"], ["chamado", "Chamado"], ["outro", "Outro"]];
const ROTULO_STATUS: Record<string, string> = { fila: "Na fila", enviada: "Enviada", entregue: "Entregue", lida: "Lida", falhou: "Falhou", recebida: "Recebida" };

async function admin() {
  const { perfil } = await getContexto();
  if (perfil?.role !== "admin") redirect("/dashboard");
}

async function salvarConfig(fd: FormData) {
  "use server";
  await admin();
  const supabase = await createClient();
  const { perfil } = await getContexto();
  const { error } = await supabase.from("whatsapp_config").upsert({
    company_id: perfil!.company_id,
    ativo: fd.get("ativo") === "on",
    phone_number_id: String(fd.get("phone_number_id") ?? "").trim() || null,
    waba_id: String(fd.get("waba_id") ?? "").trim() || null,
    api_version: String(fd.get("api_version") ?? "v21.0").trim() || "v21.0",
    updated_at: new Date().toISOString(),
  });
  if (error) redirect("/whatsapp?erro=" + encodeURIComponent(error.message));
  revalidatePath("/whatsapp");
  redirect("/whatsapp?ok=" + encodeURIComponent("Configuração salva."));
}

async function salvarModelo(fd: FormData) {
  "use server";
  await admin();
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  const dados = {
    evento: String(fd.get("evento") ?? "outro"),
    titulo: String(fd.get("titulo") ?? "").trim() || "Modelo",
    nome_meta: String(fd.get("nome_meta") ?? "").trim() || null,
    idioma: String(fd.get("idioma") ?? "pt_BR").trim() || "pt_BR",
    corpo: String(fd.get("corpo") ?? "").slice(0, 1024),
    ativo: fd.get("ativo") === "on",
  };
  const { error } = id ? await supabase.from("whatsapp_templates").update(dados).eq("id", id) : await supabase.from("whatsapp_templates").insert(dados);
  if (error) redirect("/whatsapp?erro=" + encodeURIComponent(error.message));
  revalidatePath("/whatsapp");
  redirect("/whatsapp?ok=" + encodeURIComponent("Modelo salvo."));
}

async function excluirModelo(fd: FormData) {
  "use server";
  await admin();
  const supabase = await createClient();
  await supabase.from("whatsapp_templates").delete().eq("id", String(fd.get("id")));
  revalidatePath("/whatsapp");
  redirect("/whatsapp?ok=" + encodeURIComponent("Modelo excluído."));
}

async function testar(fd: FormData) {
  "use server";
  await admin();
  const supabase = await createClient();
  const evento = String(fd.get("evento") ?? "outro");
  const vars = [1, 2, 3, 4].map((i) => String(fd.get("v" + i) ?? "")).filter((v) => v !== "");
  const r = await enviarModelo(supabase, { telefone: String(fd.get("telefone") ?? ""), evento, vars });
  revalidatePath("/whatsapp");
  redirect("/whatsapp?" + (r.ok ? "ok=" + encodeURIComponent("Mensagem de teste enviada.") : "erro=" + encodeURIComponent(r.motivo ?? "Não foi possível enviar.")));
}

export default async function Whatsapp({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  await admin();
  const { erro, ok } = await searchParams;
  const supabase = await createClient();
  const [{ data: cfg }, { data: modelos }, { data: msgs }] = await Promise.all([
    supabase.from("whatsapp_config").select("*").maybeSingle(),
    supabase.from("whatsapp_templates").select("*").order("created_at"),
    supabase.from("whatsapp_messages").select("id, direcao, telefone, tipo, modelo, corpo, status, erro, created_at").order("created_at", { ascending: false }).limit(40),
  ]);
  const seg = segredosOk();
  const pronto = !!cfg?.ativo && !!cfg?.phone_number_id && seg.token;
  const Passo = ({ feito, children }: { feito: boolean; children: ReactNode }) => (
    <li style={{ margin: "4px 0" }}>{feito ? "✅" : "⬜"} {children}</li>
  );

  return (
    <main className="wrap">
      <h1 className="title">WhatsApp (API oficial)</h1>
      <p className="muted">Envio automático de mensagens pela WhatsApp Cloud API da Meta, com registro de tudo que sai e chega. Enquanto estiver desligado, nada é enviado.</p>
      {erro && <div className="error" style={{ margin: "12px 0" }}>{erro}</div>}
      {ok && <div className="card" style={{ margin: "12px 0", borderLeft: "4px solid #16a34a" }}>{ok}</div>}

      <section className="card" style={{ marginBottom: 14 }}>
        <h2 style={{ marginTop: 0 }}>Situação: {pronto ? "🟢 pronto para enviar" : "🔴 ainda não está enviando"}</h2>
        <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
          <Passo feito={seg.token}>Token permanente na Vercel (<code>WHATSAPP_TOKEN</code>)</Passo>
          <Passo feito={seg.verify}>Senha de verificação do webhook na Vercel (<code>WHATSAPP_VERIFY_TOKEN</code>)</Passo>
          <Passo feito={seg.appSecret}>Segredo do app na Vercel (<code>WHATSAPP_APP_SECRET</code>)</Passo>
          <Passo feito={!!cfg?.phone_number_id}>ID do número de telefone preenchido abaixo</Passo>
          <Passo feito={!!cfg?.ativo}>Envio ligado abaixo</Passo>
        </ul>
        <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
          Os segredos (token e senhas) ficam só nas variáveis de ambiente da Vercel, nunca nesta tela nem no banco.
        </p>
      </section>

      <section className="card" style={{ marginBottom: 14 }}>
        <h2 style={{ marginTop: 0 }}>Configuração</h2>
        <form action={salvarConfig} style={{ display: "grid", gap: 10 }}>
          <label className="field">ID do número de telefone (Phone number ID)
            <input name="phone_number_id" defaultValue={cfg?.phone_number_id ?? ""} inputMode="numeric" />
          </label>
          <label className="field">ID da conta do WhatsApp Business (WABA ID)
            <input name="waba_id" defaultValue={cfg?.waba_id ?? ""} inputMode="numeric" />
          </label>
          <label className="field">Versão da API
            <input name="api_version" defaultValue={cfg?.api_version ?? "v21.0"} />
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" name="ativo" defaultChecked={!!cfg?.ativo} style={{ width: 20, height: 20 }} /> Ligar o envio de mensagens
          </label>
          <div><button className="btn primary">Salvar configuração</button></div>
        </form>
        <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
          No painel da Meta (Webhooks), use a URL <code>{SITE}/api/whatsapp/webhook</code> e a mesma senha de verificação que você colocar em <code>WHATSAPP_VERIFY_TOKEN</code>. Assine os campos <b>messages</b> para receber entregas e respostas.
        </p>
      </section>

      <section className="card" style={{ marginBottom: 14 }}>
        <h2 style={{ marginTop: 0 }}>Modelos de mensagem</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Para iniciar uma conversa, a Meta exige modelos aprovados por ela. Cadastre aqui o <b>nome exato</b> do modelo aprovado e o texto (com {"{{1}}"}, {"{{2}}"}… para os campos variáveis). Só modelos ativos com nome preenchido são enviados.
        </p>
        {(modelos ?? []).map((m: any) => (
          <details key={m.id} className="os-bloco" style={{ marginBottom: 8 }}>
            <summary style={{ cursor: "pointer" }}>
              <b>{m.titulo}</b> · {EVENTOS.find(([k]) => k === m.evento)?.[1] ?? m.evento} · {m.ativo && m.nome_meta ? "🟢 ativo" : "⚪ inativo"}
            </summary>
            <form action={salvarModelo} style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <input type="hidden" name="id" value={m.id} />
              <label className="field">Título<input name="titulo" defaultValue={m.titulo} /></label>
              <label className="field">Quando usar
                <select name="evento" defaultValue={m.evento}>{EVENTOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
              </label>
              <label className="field">Nome do modelo aprovado na Meta<input name="nome_meta" defaultValue={m.nome_meta ?? ""} placeholder="ex.: os_pronta" /></label>
              <label className="field">Idioma<input name="idioma" defaultValue={m.idioma} /></label>
              <label className="field">Texto do modelo<textarea name="corpo" rows={4} defaultValue={m.corpo} maxLength={1024} /></label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="ativo" defaultChecked={m.ativo} style={{ width: 20, height: 20 }} /> Ativo</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn primary">Salvar modelo</button>
                <button className="btn secondary" formAction={excluirModelo}>Excluir</button>
              </div>
            </form>
          </details>
        ))}
        <details className="os-bloco">
          <summary style={{ cursor: "pointer" }}><b>+ Novo modelo</b></summary>
          <form action={salvarModelo} style={{ display: "grid", gap: 8, marginTop: 8 }}>
            <label className="field">Título<input name="titulo" required /></label>
            <label className="field">Quando usar
              <select name="evento" defaultValue="outro">{EVENTOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
            </label>
            <label className="field">Nome do modelo aprovado na Meta<input name="nome_meta" /></label>
            <label className="field">Idioma<input name="idioma" defaultValue="pt_BR" /></label>
            <label className="field">Texto do modelo<textarea name="corpo" rows={4} maxLength={1024} required /></label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="ativo" defaultChecked style={{ width: 20, height: 20 }} /> Ativo</label>
            <div><button className="btn primary">Criar modelo</button></div>
          </form>
        </details>
      </section>

      <section className="card" style={{ marginBottom: 14 }}>
        <h2 style={{ marginTop: 0 }}>Enviar mensagem de teste</h2>
        <form action={testar} style={{ display: "grid", gap: 8 }}>
          <label className="field">Telefone (com DDD)<input name="telefone" inputMode="tel" required /></label>
          <label className="field">Modelo a testar
            <select name="evento">{EVENTOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
            {[1, 2, 3, 4].map((i) => <label key={i} className="field">Valor de {"{{" + i + "}}"}<input name={"v" + i} /></label>)}
          </div>
          <div><button className="btn secondary" disabled={!pronto}>Enviar teste</button> {!pronto && <span className="muted" style={{ fontSize: 13 }}>Disponível quando a situação estiver 🟢.</span>}</div>
        </form>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Últimas mensagens</h2>
        {!(msgs ?? []).length && <p className="muted">Nenhuma mensagem registrada ainda.</p>}
        <div style={{ display: "grid", gap: 8 }}>
          {(msgs ?? []).map((m: any) => (
            <div key={m.id} className="os-bloco">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <b>{m.direcao === "saida" ? "➡ Enviada para" : "⬅ Recebida de"} {m.telefone}</b>
                <span className="muted">{ROTULO_STATUS[m.status] ?? m.status} · {new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
              </div>
              {m.corpo && <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{m.corpo}</div>}
              {m.erro && <div className="error" style={{ marginTop: 4 }}>{m.erro}</div>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
