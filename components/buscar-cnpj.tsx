"use client";
import { useState } from "react";

// Preenche o cadastro a partir do CNPJ (BrasilAPI). Só para CNPJ de 14 dígitos.
export default function BuscarCnpj() {
  const [msg, setMsg] = useState("");
  async function buscar(e: React.MouseEvent<HTMLButtonElement>) {
    const form = (e.currentTarget as HTMLElement).closest("form")!;
    const get = (n: string) => form.querySelector<HTMLInputElement>(`[name="${n}"]`);
    const cnpj = (get("document")?.value ?? "").replace(/\D/g, "");
    if (cnpj.length !== 14) return setMsg("Digite um CNPJ com 14 dígitos.");
    setMsg("Buscando…");
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!r.ok) return setMsg("CNPJ não encontrado.");
      const d = await r.json();
      const set = (n: string, v: any) => {
        const el = get(n);
        if (el && v) {
          el.value = String(v);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      };
      set("name", d.razao_social);
      set("trade_name", d.nome_fantasia);
      set("cep", String(d.cep ?? "").replace(/^(\d{5})(\d{3})$/, "$1-$2"));
      set("address", [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" "));
      set("street_number", d.numero);
      set("complement", d.complemento);
      set("neighborhood", d.bairro);
      set("city", d.municipio);
      set("state", d.uf);
      set("municipal_code", d.codigo_municipio_ibge ?? d.codigo_municipio);
      set("email", d.email);
      set("phone", d.ddd_telefone_1);
      setMsg("Dados preenchidos — confira antes de salvar.");
    } catch {
      setMsg("Não foi possível consultar agora.");
    }
  }
  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <button type="button" className="btn secondary" onClick={buscar}>🔍 Buscar (CNPJ)</button>
      {msg && <span className="muted">{msg}</span>}
    </span>
  );
}
