import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function trocar(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const senha = String(formData.get("senha") || "");
  const confirma = String(formData.get("confirma") || "");
  if (senha.length < 8) redirect("/trocar-senha?erro=" + encodeURIComponent("Use pelo menos 8 caracteres."));
  if (senha !== confirma) redirect("/trocar-senha?erro=" + encodeURIComponent("As senhas não conferem."));
  const { error } = await supabase.auth.updateUser({ password: senha, data: { must_change_password: false } });
  if (error) redirect("/trocar-senha?erro=" + encodeURIComponent(error.message));
  redirect("/dashboard");
}

export default async function TrocarSenha({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="wrap" style={{ maxWidth: 440 }}>
      <h1 className="title">Defina sua senha</h1>
      <p className="muted">Sua conta foi criada com uma senha provisória. Escolha agora uma senha só sua.</p>
      {erro && <div className="error" style={{ margin: "14px 0" }}>{erro}</div>}
      <form action={trocar} className="card" style={{ display: "grid", gap: 12 }}>
        <label className="field">
          Nova senha
          <input name="senha" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        <label className="field">
          Repita a nova senha
          <input name="confirma" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        <button className="btn primary">Salvar senha</button>
      </form>
    </main>
  );
}
