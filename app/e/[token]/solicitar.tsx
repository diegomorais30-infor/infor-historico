"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  token: string;
  whatsapp: string | null;
  code: string;
  equipamento: string;
  local: string | null;
};

function linkWhatsapp(numero: string, texto: string) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

export default function Solicitar({ token, whatsapp, code, equipamento, local }: Props) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [descricao, setDescricao] = useState("");
  const [armadilha, setArmadilha] = useState(""); // campo escondido: robôs preenchem, pessoas não
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [protocolo, setProtocolo] = useState("");
  const [numeroZap, setNumeroZap] = useState<string | null>(whatsapp);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (armadilha) return;
    setErro("");
    setLoading(true);
    const { data, error } = await createClient().rpc("create_service_request", {
      p_token: token,
      p_name: nome,
      p_phone: telefone,
      p_description: descricao,
    });
    setLoading(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setProtocolo(data.protocol);
    setNumeroZap(data.whatsapp ?? whatsapp);
  }

  const mensagemPedido = `Olá! Abri o chamado ${protocolo} pelo QR code.\nImpressora: ${code} (${equipamento})${
    local ? `\nLocal: ${local}` : ""
  }\nProblema: ${descricao}\nContato: ${nome} - ${telefone}`;

  if (protocolo) {
    return (
      <section className="card" style={{ marginTop: 18 }}>
        <h2>Pedido recebido</h2>
        <p>
          Seu protocolo é <b>{protocolo}</b>. Guarde este número.
        </p>
        {numeroZap ? (
          <>
            <p className="muted">Toque abaixo para avisar nossa equipe pelo WhatsApp e agilizar o atendimento.</p>
            <a className="btn primary" href={linkWhatsapp(numeroZap, mensagemPedido)} target="_blank" rel="noreferrer">
              Enviar pelo WhatsApp
            </a>
          </>
        ) : (
          <p className="muted">Nossa equipe entrará em contato pelo telefone informado.</p>
        )}
      </section>
    );
  }

  return (
    <section className="card" style={{ marginTop: 18 }}>
      <h2>Solicitar manutenção</h2>
      <p className="muted">Conte o problema e nossa equipe entra em contato.</p>
      <form onSubmit={enviar} style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <label className="field">
          Seu nome
          <input required value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} autoComplete="name" />
        </label>
        <label className="field">
          Telefone / WhatsApp com DDD
          <input
            required
            type="tel"
            inputMode="tel"
            placeholder="(38) 99999-9999"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            autoComplete="tel"
          />
        </label>
        <label className="field">
          O que está acontecendo?
          <textarea required rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={1000} />
        </label>
        <input
          type="text"
          name="site"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={armadilha}
          onChange={(e) => setArmadilha(e.target.value)}
          style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }}
        />
        {erro && <div className="error">{erro}</div>}
        <button className="btn primary" disabled={loading}>
          {loading ? "Enviando..." : "Enviar pedido"}
        </button>
        {whatsapp && (
          <a
            className="muted"
            style={{ textAlign: "center" }}
            href={linkWhatsapp(whatsapp, `Olá! Preciso de ajuda com a impressora ${code} (${equipamento}).`)}
            target="_blank"
            rel="noreferrer"
          >
            Prefere falar direto? Abrir o WhatsApp
          </a>
        )}
      </form>
    </section>
  );
}
