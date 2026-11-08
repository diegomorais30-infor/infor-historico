"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type Item = { id: string; code: string; marca: string; serie: string; token: string; tag: string; cliente: string };

function fmtFone(n: string) {
  let d = (n || "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return n;
}

export default function Etiquetas({ itens, whatsapp, empresa, slug }: { itens: Item[]; whatsapp: string; empresa: string; slug: string }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [cli, setCli] = useState("");
  const [soTag, setSoTag] = useState(true);
  const clientes = useMemo(() => Array.from(new Set(itens.map((i) => i.cliente).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [itens]);
  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return itens
      .filter((i) => (!soTag || i.tag) && (!cli || i.cliente === cli) && (!t || `${i.tag} ${i.code} ${i.marca} ${i.serie} ${i.cliente}`.toLowerCase().includes(t)))
      .sort((a, b) => a.cliente.localeCompare(b.cliente) || a.tag.localeCompare(b.tag, undefined, { numeric: true }));
  }, [itens, busca, cli, soTag]);
  const [qrs, setQrs] = useState<Record<string, string>>({});

  const escolhidos = useMemo(() => itens.filter((i) => sel.has(i.id)), [itens, sel]);

  useEffect(() => {
    const base = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "");
    let vivo = true;
    (async () => {
      const novo: Record<string, string> = {};
      for (const i of escolhidos) {
        novo[i.id] = await QRCode.toDataURL(i.tag && slug ? `${base}/p/${slug}/${encodeURIComponent(i.tag)}` : `${base}/e/${i.token}`, { width: 700, margin: 0, errorCorrectionLevel: "M" });
      }
      if (vivo) setQrs(novo);
    })();
    return () => {
      vivo = false;
    };
  }, [escolhidos, slug]);

  function alterna(id: string) {
    const n = new Set(sel);
    n.has(id) ? n.delete(id) : n.add(id);
    setSel(n);
  }

  const folhas: Item[][] = [];
  for (let i = 0; i < escolhidos.length; i += 4) folhas.push(escolhidos.slice(i, i + 4));

  return (
    <>
      <section className="card no-print" style={{ marginBottom: 16 }}>
        <div className="headrow">
          <strong>
            {escolhidos.length} de {itens.length} selecionado(s) · {folhas.length} folha(s)
          </strong>
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn secondary" onClick={() => setSel(new Set([...sel, ...visiveis.map((i) => i.id)]))}>
              Marcar os {visiveis.length} da lista
            </button>
            <button type="button" className="btn secondary" onClick={() => setSel(new Set())}>
              Limpar
            </button>
            <button type="button" className="btn primary" disabled={!escolhidos.length} onClick={() => window.print()}>
              Imprimir
            </button>
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar patrimônio, modelo, série ou cliente" style={{ flex: 1, minWidth: 220 }} />
          <select value={cli} onChange={(e) => setCli(e.target.value)}>
            <option value="">Todos os clientes</option>
            {clientes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={soTag} onChange={(e) => setSoTag(e.target.checked)} /> Só com patrimônio
          </label>
        </div>
        <div style={{ display: "grid", gap: 6, marginTop: 10, maxHeight: 420, overflowY: "auto" }}>
          {visiveis.map((i) => (
            <label key={i.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={sel.has(i.id)} onChange={() => alterna(i.id)} />
              <span>
                <strong>{i.tag ? `Patrimônio ${i.tag}` : i.code}</strong> — {i.marca || "sem modelo"} {i.serie && `· série ${i.serie}`}
                {i.cliente && <span className="muted"> · {i.cliente}</span>}
              </span>
            </label>
          ))}
          {!visiveis.length && <span className="muted">Nenhum equipamento encontrado com esses filtros.</span>}
        </div>
      </section>

      <div className="folhas">
        {folhas.map((f, n) => (
          <div className="folha" key={n}>
            {f.map((i) => (
              <div className="etq" key={i.id}>
                <img src="/logo-infor.jpg" alt={empresa || "Infor Cartuchos"} className="etq-logo" />
                <div className="etq-cta">Escaneie para ver o histórico ou pedir manutenção</div>
                {qrs[i.id] ? <img src={qrs[i.id]} alt={`QR ${i.code}`} className="etq-qr" /> : <div className="etq-qr" />}
                <div className="etq-code">{i.tag ? `Patrimônio ${i.tag}` : i.code}</div>
                {i.marca && <div className="etq-linha">{i.marca}</div>}
                {i.serie && <div className="etq-linha">Série: {i.serie}</div>}
                {whatsapp && <div className="etq-zap">WhatsApp {fmtFone(whatsapp)}</div>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
