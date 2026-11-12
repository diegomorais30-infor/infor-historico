import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Avisos no celular do app "Painel Infor Cartuchos" (painel-infor.vercel.app):
// chegada de chamado e chamado concluído. O painel é outro site, então tem as próprias inscrições (app = 'painel').
const ORIGEM_PAINEL = "https://painel-infor.vercel.app";
const CORS = { "Access-Control-Allow-Origin": ORIGEM_PAINEL, "Access-Control-Allow-Methods": "GET", Vary: "Origin" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function igual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

// O painel pede a chave pública para inscrever o aparelho.
export async function GET() {
  return NextResponse.json({ chave: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "" }, { headers: CORS });
}

// Chamada pelo banco (gatilho do painel_chamados). Só aceita quem conhece o segredo.
export async function POST(req: Request) {
  const segredo = process.env.PUSH_WEBHOOK_SECRET;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!segredo || !pub || !priv) return NextResponse.json({ erro: "configuração incompleta" }, { status: 500 });
  if (!igual(req.headers.get("x-webhook-secret") ?? "", segredo)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const corpo = await req.json().catch(() => null);
  if (!corpo || typeof corpo.company_id !== "string" || !UUID.test(corpo.company_id)) {
    return NextResponse.json({ erro: "dados inválidos" }, { status: 400 });
  }
  const autor = typeof corpo.autor === "string" && UUID.test(corpo.autor) ? corpo.autor : null;

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://inforgest.com.br", pub, priv);
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data: inscricoes, error } = await supabase.rpc("push_listar_app", {
    p_segredo: segredo,
    p_company: corpo.company_id,
    p_app: "painel",
  });
  if (error) return NextResponse.json({ erro: "falha ao listar" }, { status: 500 });

  const payload = JSON.stringify({
    title: texto(corpo.titulo, 80) || "Painel Infor Cartuchos",
    body: texto(corpo.corpo, 200),
    url: "/",
    tag: texto(corpo.tag, 60) || "painel",
  });

  let enviados = 0;
  await Promise.all(
    ((inscricoes as { endpoint: string; p256dh: string; auth: string; user_id: string | null }[]) ?? [])
      .filter((s) => !autor || s.user_id !== autor) // quem fez a mudança não precisa ser avisado
      .map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
          enviados++;
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await supabase.rpc("push_remover", { p_segredo: segredo, p_endpoint: s.endpoint });
          }
        }
      })
  );
  return NextResponse.json({ ok: true, enviados });
}
