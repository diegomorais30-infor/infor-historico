import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Recebe o link do e-mail (recuperação de senha), troca o código por uma sessão e segue para a próxima tela.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const next = u.searchParams.get("next") ?? "/dashboard";
  const destino = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destino, u.origin));
  }
  return NextResponse.redirect(new URL("/esqueci-senha?expirou=1", u.origin));
}
