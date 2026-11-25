import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { erroSenha } from "@/lib/erro-senha";
import CampoSenha from "@/components/campo-senha";

async function redefinir(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/esqueci-senha?expirou=1");
  const senha = String(formData.get("senha") || "");
  const confirma = String(formData.get("confirma") || "");
  if (senha.length < 8) redirect("/redefinir-senha?erro=" + encodeURIComponent("Use pelo menos 8 caracteres."));
  if (senha !== confirma) redirect("/redefinir-senha?erro=" + encodeURIComponent("As senhas não conferem."));
  const { error } = await supabase.auth.updateUser({ password: senha, data: { must_change_password: false } });
  if (error) redirect("/redefinir-senha?erro=" + encodeURIComponent(erroSenha(error.message)));
  await supabase.auth.refreshSession();
  redirect("/dashboard");
}

export default async function RedefinirSenha({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/esqueci-senha?expirou=1");
  const { erro } = await searchParams;
  return (
    <main className="wrap" style={{ maxWidth: 440 }}>
      <h1 className="title">Criar nova senha</h1>
      {erro && <div className="error" style={{ margin: "14px 0" }}>{erro}</div>}
      <div className="card" style={{ margin: "14px 0", borderLeft: "4px solid #f59e0b" }}>
        <strong>⚠ Atenção: a senha precisa ser forte</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.6 }}>
          <li>No mínimo <strong>8 caracteres</strong>, misturando letras, números e um símbolo (ex.: ! - @).</li>
          <li>Não use seu nome, o nome da empresa, datas nem sequências como <em>12345678</em> ou <em>senha123</em>.</li>
          <li>Senhas comuns ou já vazadas na internet são recusadas pelo sistema.</li>
        </ul>
      </div>
      <form action={redefinir} className="card" style={{ display: "grid", gap: 12 }}>
        <label className="field">Nova senha<CampoSenha name="senha" required minLength={8} autoComplete="new-password" /></label>
        <label className="field">Repita a nova senha<CampoSenha name="confirma" required minLength={8} autoComplete="new-password" /></label>
        <button className="btn primary">Salvar senha</button>
      </form>
    </main>
  );
}
