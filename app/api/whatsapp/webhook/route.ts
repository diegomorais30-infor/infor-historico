import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// A Meta chama este endereço para (1) verificar o webhook e (2) avisar de entrega/leitura e mensagens recebidas.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const ok = u.searchParams.get("hub.mode") === "subscribe" && !!process.env.WHATSAPP_VERIFY_TOKEN && u.searchParams.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN;
  if (!ok) return new NextResponse("forbidden", { status: 403 });
  return new NextResponse(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
}

function assinaturaValida(corpo: string, cab: string | null) {
  const segredo = process.env.WHATSAPP_APP_SECRET;
  if (!segredo || !cab?.startsWith("sha256=")) return false;
  const esperado = createHmac("sha256", segredo).update(corpo).digest("hex");
  const recebido = cab.slice(7);
  const a = Buffer.from(esperado), b = Buffer.from(recebido);
  return a.length === b.length && timingSafeEqual(a, b);
}

const STATUS: Record<string, string> = { sent: "enviada", delivered: "entregue", read: "lida", failed: "falhou" };

export async function POST(req: Request) {
  const corpo = await req.text();
  if (!assinaturaValida(corpo, req.headers.get("x-hub-signature-256"))) return new NextResponse("assinatura inválida", { status: 401 });
  let j: any;
  try { j = JSON.parse(corpo); } catch { return new NextResponse("ok", { status: 200 }); }
  const db = createAdminClient();
  for (const e of j?.entry ?? []) {
    for (const c of e?.changes ?? []) {
      const v = c?.value;
      const pid = v?.metadata?.phone_number_id;
      if (!pid) continue;
      const { data: cfg } = await db.from("whatsapp_config").select("company_id").eq("phone_number_id", String(pid)).maybeSingle();
      if (!cfg) continue;
      for (const s of v?.statuses ?? []) {
        const st = STATUS[s.status];
        if (!st || !s.id) continue;
        await db.from("whatsapp_messages").update({ status: st, erro: s.errors?.[0]?.title ?? null, atualizado_em: new Date().toISOString() }).eq("company_id", cfg.company_id).eq("wa_id", s.id);
      }
      for (const m of v?.messages ?? []) {
        const fone = String(m.from ?? "");
        const { data: ja } = await db.from("whatsapp_messages").select("id").eq("company_id", cfg.company_id).eq("wa_id", m.id).maybeSingle();
        if (ja) continue;
        const texto = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? `[${m.type ?? "mensagem"}]`;
        const { data: cli } = await db.from("clients").select("id").eq("company_id", cfg.company_id).or(`phone.ilike.%${fone.slice(-8)}%,mobile.ilike.%${fone.slice(-8)}%`).limit(1).maybeSingle();
        await db.from("whatsapp_messages").insert({ company_id: cfg.company_id, direcao: "entrada", telefone: fone, tipo: m.type === "text" ? "texto" : String(m.type ?? "outro"), corpo: texto, status: "recebida", wa_id: m.id, client_id: cli?.id ?? null });
      }
    }
  }
  return new NextResponse("ok", { status: 200 });
}
