"use client";
import { useMemo, useState } from "react";
import { criarClienteRapido } from "@/app/os/nova/actions";

type C = { id: string; name: string; document?: string | null };

export default function SeletorCliente({ clientes, inicial }: { clientes: C[]; inicial?: string }) {
  const [lista, setLista] = useState<C[]>(clientes);
  const [id, setId] = useState(inicial ?? "");
  const [texto, setTexto] = useState(clientes.find((c) => c.id === inicial)?.name ?? "");
  const [aberto, setAberto] = useState(false);
  const [modal, setModal] = useState(false);
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [f, setF] = useState({ nome: "", celular: "", documento: "", telefone: "", email: "", tipo: "fisica" as "fisica" | "juridica", cep: "" });

  const achados = useMemo(() => {
    const t = texto.trim().toLowerCase();
    const dig = t.replace(/\D/g, "");
    return lista.filter((c) => !t || c.name.toLowerCase().includes(t) || (dig.length >= 3 && (c.document ?? "").replace(/\D/g, "").includes(dig))).slice(0, 8);
  }, [texto, lista]);

  async function salvar() {
    setSalvando(true);
    setMsg("");
    const r = await criarClienteRapido(f);
    setSalvando(false);
    if (r.erro || !r.id) return setMsg(r.erro ?? "Erro ao cadastrar.");
    setLista((l) => (l.some((c) => c.id === r.id) ? l : [...l, { id: r.id!, name: r.name!, document: f.documento || null }]));
    setId(r.id);
    setTexto(r.name ?? "");
    setModal(false);
    setF({ nome: "", celular: "", documento: "", telefone: "", email: "", tipo: "fisica", cep: "" });
    if (r.aviso) setMsg(r.aviso);
  }

  const campo = (k: keyof typeof f, rot: string, ph = "", tipo = "text") => (
    <label className="field">
      {rot}
      <input type={tipo} placeholder={ph} value={f[k] as string} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </label>
  );

  return (
    <div style={{ position: "relative" }}>
      <input type="hidden" name="client_id" value={id} />
      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{ flex: 1 }}
          placeholder="Digite para buscar (nome ou CPF/CNPJ)…"
          value={texto}
          required
          onChange={(e) => {
            setTexto(e.target.value);
            setId("");
            setAberto(true);
            e.target.setCustomValidity("Escolha um cliente da lista ou use + Cliente.");
          }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          ref={(el) => el?.setCustomValidity(id ? "" : "Escolha um cliente da lista ou use + Cliente.")}
        />
        <button type="button" className="btn secondary" onClick={() => { setModal(true); setF((x) => ({ ...x, nome: id ? "" : texto })); }}>+ Cliente</button>
      </div>
      {msg && !modal && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{msg}</div>}
      {aberto && (
        <div className="cfg-pop" style={{ top: 42, left: 0, right: 0, minWidth: 0, gap: 0, padding: 4 }}>
          {achados.map((c) => (
            <button key={c.id} type="button" className="sel-item" onMouseDown={() => { setId(c.id); setTexto(c.name); setAberto(false); }}>
              <b>{c.name}</b>{c.document ? <span className="muted"> · {c.document}</span> : null}
            </button>
          ))}
          {!achados.length && <div className="muted" style={{ padding: 8, fontSize: 13 }}>Nenhum cliente encontrado. Use “+ Cliente” para cadastrar agora.</div>}
        </div>
      )}
      {modal && (
        <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-caixa" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!salvando) salvar(); } }}>
            <div className="headrow" style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>Adicionar cliente</h2>
              <button type="button" className="btn secondary" onClick={() => setModal(false)}>✕</button>
            </div>
            <div className="grid g2">
              <div style={{ gridColumn: "1/-1" }}>{campo("nome", "Nome completo", "Nome e sobrenome")}</div>
              {campo("celular", "Celular / WhatsApp", "(00) 00000-0000")}
              {campo("documento", "CPF / CNPJ", "Opcional")}
              {campo("telefone", "Telefone fixo", "(00) 0000-0000")}
              {campo("email", "E-mail", "email@exemplo.com", "email")}
              {campo("cep", "CEP", "00000-000")}
              <label className="field">Tipo de pessoa
                <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as any })}><option value="fisica">Física</option><option value="juridica">Jurídica</option></select>
              </label>
            </div>
            {msg && <div className="error" style={{ marginTop: 10 }}>{msg}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button type="button" className="btn secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button type="button" className="btn primary" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Adicionar"}</button>
            </div>
            <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>O restante do cadastro (endereço, observações) pode ser completado depois em Clientes.</p>
          </div>
        </div>
      )}
    </div>
  );
}
