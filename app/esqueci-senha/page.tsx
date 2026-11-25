"use client";
import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/client";

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const expirou = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("expirou") === "1";

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro("");
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
    });
    setCarregando(false);
    if (error && /rate|limit|many/i.test(error.message)) { setErro("Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo."); return; }
    setEnviado(true); // mesma resposta exista ou não o e-mail (não revela quem tem conta)
  }

  return (
    <main className="login"><div className="card">
      <div className="brand"><Logo /></div>
      <h1 className="title" style={{ marginTop: 25 }}>Esqueci minha senha</h1>
      {enviado ? (
        <>
          <p>Se este e-mail tiver cadastro, enviamos um link para criar uma nova senha. Confira também a caixa de spam.</p>
          <Link href="/login" className="btn secondary" style={{ display: "block", textAlign: "center", marginTop: 14 }}>Voltar para o login</Link>
        </>
      ) : (
        <form onSubmit={enviar} style={{ display: "grid", gap: 14, marginTop: 12 }}>
          <p className="muted" style={{ margin: 0 }}>Informe o e-mail do seu cadastro e enviaremos um link para criar uma nova senha.</p>
          <label className="field">E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          {expirou && !erro && <div className="error">O link expirou ou já foi usado. Peça um novo abaixo.</div>}
          {erro && <div className="error">{erro}</div>}
          <button className="btn primary" disabled={carregando}>{carregando ? "Enviando..." : "Enviar link"}</button>
          <Link href="/login" className="muted" style={{ textAlign: "center" }}>Voltar para o login</Link>
        </form>
      )}
    </div></main>
  );
}
