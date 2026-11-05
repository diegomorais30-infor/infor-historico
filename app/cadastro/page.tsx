"use client";

import { useState } from "react";
import { NOME_PRODUTO } from "@/lib/marca";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Cadastro() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [loading, setLoading] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setAviso("");
    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    setLoading(true);
    const { data, error } = await createClient().auth.signUp({
      email,
      password: senha,
      options: {
        data: { full_name: nome, company_name: empresa },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setAviso("Conta criada. Confirme seu e-mail pelo link que enviamos e depois entre no sistema.");
    setLoading(false);
  }

  return (
    <main className="login">
      <div className="card">
        <div className="brand">
          <span className="circles">
            <i className="c" />
            <i className="c" />
            <i className="c" />
          </span>
          <span>{NOME_PRODUTO}</span>
        </div>
        <h1 className="title" style={{ marginTop: 25 }}>
          Criar conta
        </h1>
        <p className="muted">
          Se você foi convidado, use o mesmo e-mail do convite. Sem convite, criamos a sua empresa com 7 dias de teste.
        </p>
        <form onSubmit={enviar} style={{ display: "grid", gap: 14, marginTop: 20 }}>
          <label className="field">
            Seu nome
            <input required value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="field">
            Nome da empresa (se não foi convidado)
            <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
          </label>
          <label className="field">
            E-mail
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            Senha (mínimo 8 caracteres)
            <input type="password" required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} />
          </label>
          {erro && <div className="error">{erro}</div>}
          {aviso && <div className="ok">{aviso}</div>}
          <button className="btn primary" disabled={loading}>
            {loading ? "Criando..." : "Criar conta"}
          </button>
          <Link href="/login" className="muted" style={{ textAlign: "center" }}>
            Já tenho conta
          </Link>
        </form>
      </div>
    </main>
  );
}
