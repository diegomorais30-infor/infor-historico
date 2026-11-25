// WhatsApp Cloud API (oficial da Meta). Segredos ficam só nas variáveis de ambiente da Vercel:
//   WHATSAPP_TOKEN (token permanente), WHATSAPP_VERIFY_TOKEN (você escolhe), WHATSAPP_APP_SECRET (segredo do app).
// Enquanto "ativo" estiver desligado ou o token ausente, nada é enviado e o motivo é devolvido.

export function segredosOk() {
  return {
    token: !!process.env.WHATSAPP_TOKEN,
    verify: !!process.env.WHATSAPP_VERIFY_TOKEN,
    appSecret: !!process.env.WHATSAPP_APP_SECRET,
  };
}

// Telefone só com dígitos, com o 55 do Brasil.
export function normalizaFone(t: string | null | undefined): string | null {
  const n = String(t ?? "").replace(/\D/g, "");
  if (n.length < 10) return null;
  return n.length <= 11 ? `55${n}` : n;
}

// Troca {{1}}, {{2}}... pelo valor correspondente (para exibir/guardar o texto enviado).
export function preencher(corpo: string, vars: string[]) {
  return corpo.replace(/\{\{(\d+)\}\}/g, (_, i) => vars[Number(i) - 1] ?? "");
}

type Resultado = { ok: boolean; motivo?: string; waId?: string };

async function chamar(cfg: any, payload: any): Promise<Resultado> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) return { ok: false, motivo: "Token do WhatsApp não configurado na Vercel (WHATSAPP_TOKEN)." };
  try {
    const r = await fetch(`https://graph.facebook.com/${cfg.api_version || "v21.0"}/${cfg.phone_number_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, motivo: j?.error?.message ?? `Erro ${r.status} da API do WhatsApp` };
    return { ok: true, waId: j?.messages?.[0]?.id };
  } catch (e: any) {
    return { ok: false, motivo: String(e?.message ?? e) };
  }
}

// Envia um modelo aprovado (único tipo permitido para iniciar conversa). Registra tudo em whatsapp_messages.
export async function enviarModelo(
  supabase: any,
  o: { telefone: string | null | undefined; evento: string; vars: string[]; orderId?: string | null; clientId?: string | null },
): Promise<Resultado> {
  const fone = normalizaFone(o.telefone);
  if (!fone) return { ok: false, motivo: "Telefone do cliente inválido." };
  const { data: cfg } = await supabase.from("whatsapp_config").select("*").maybeSingle();
  if (!cfg?.ativo) return { ok: false, motivo: "Envio pelo WhatsApp está desligado." };
  if (!cfg.phone_number_id) return { ok: false, motivo: "Falta o ID do número de telefone nas configurações." };
  const { data: t } = await supabase.from("whatsapp_templates").select("*").eq("evento", o.evento).eq("ativo", true).limit(1).maybeSingle();
  if (!t?.nome_meta) return { ok: false, motivo: "Não há modelo ativo para este evento." };
  const texto = preencher(t.corpo, o.vars);
  const res = await chamar(cfg, {
    to: fone,
    type: "template",
    template: {
      name: t.nome_meta,
      language: { code: t.idioma || "pt_BR" },
      components: o.vars.length ? [{ type: "body", parameters: o.vars.map((v) => ({ type: "text", text: String(v ?? "") })) }] : [],
    },
  });
  await supabase.from("whatsapp_messages").insert({
    direcao: "saida", telefone: fone, tipo: "modelo", modelo: t.nome_meta, corpo: texto,
    status: res.ok ? "enviada" : "falhou", wa_id: res.waId ?? null, erro: res.ok ? null : res.motivo ?? null,
    order_id: o.orderId ?? null, client_id: o.clientId ?? null,
  });
  return res;
}

// Texto livre: só funciona se o cliente escreveu nas últimas 24 horas (regra da Meta).
export async function enviarTexto(supabase: any, o: { telefone: string; texto: string; orderId?: string | null; clientId?: string | null }): Promise<Resultado> {
  const fone = normalizaFone(o.telefone);
  if (!fone) return { ok: false, motivo: "Telefone inválido." };
  const { data: cfg } = await supabase.from("whatsapp_config").select("*").maybeSingle();
  if (!cfg?.ativo || !cfg.phone_number_id) return { ok: false, motivo: "Envio pelo WhatsApp está desligado ou incompleto." };
  const res = await chamar(cfg, { to: fone, type: "text", text: { body: o.texto, preview_url: true } });
  await supabase.from("whatsapp_messages").insert({
    direcao: "saida", telefone: fone, tipo: "texto", corpo: o.texto,
    status: res.ok ? "enviada" : "falhou", wa_id: res.waId ?? null, erro: res.ok ? null : res.motivo ?? null,
    order_id: o.orderId ?? null, client_id: o.clientId ?? null,
  });
  return res;
}
