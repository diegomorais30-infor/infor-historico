"use client";
import { useMemo, useRef, useState } from "react";

export type ItemBusca = { ref: string; nome: string; cod?: string | null; barras?: string | null; estoque?: number | null; preco?: number | null; tipo: "p" | "s" };

const moeda = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Busca de produto/serviço digitando (nome, código ou código de barras), igual ao Inforos.
export default function BuscaItem({ itens, onPreco }: { itens: ItemBusca[]; onPreco?: (v: string) => void }) {
  const [texto, setTexto] = useState("");
  const [ref, setRef] = useState("");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const inp = useRef<HTMLInputElement>(null);

  const achados = useMemo(() => {
    const t = texto.trim().toLowerCase();
    if (!t) return itens.slice(0, 8);
    const base = t.split(/\s+/).filter(Boolean);
    return itens
      .filter((i) => { const alvo = `${i.nome} ${i.cod ?? ""} ${i.barras ?? ""}`.toLowerCase(); return base.every((b) => alvo.includes(b)); })
      .slice(0, 10);
  }, [texto, itens]);

  function escolher(i: ItemBusca) {
    setRef(i.ref); setTexto(i.nome); setAberto(false);
    onPreco?.(i.preco != null ? String(i.preco).replace(".", ",") : "");
  }

  return (
    <div className="busca-item" style={{ position: "relative" }}>
      <input type="hidden" name="ref" value={ref} />
      <input
        ref={inp}
        autoFocus
        autoComplete="off"
        placeholder="🔍 Digite para buscar produto ou serviço (nome, código ou barras)…"
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setRef(""); setAberto(true); setAtivo(0); }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((a) => Math.min(a + 1, achados.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && aberto && achados[ativo]) { e.preventDefault(); escolher(achados[ativo]); }
        }}
        style={{ width: "100%", boxSizing: "border-box" }}
      />
      {aberto && (
        <div className="cfg-pop" style={{ top: 44, left: 0, right: 0, minWidth: 0, gap: 0, padding: 4, maxHeight: 320, overflowY: "auto" }}>
          {achados.map((i, k) => (
            <button key={i.ref} type="button" className="sel-item" style={k === ativo ? { background: "var(--soft)" } : undefined} onMouseDown={() => escolher(i)}>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 10, width: "100%" }}>
                <span><b>{i.nome}</b>{i.cod ? <span className="muted"> · {i.cod}</span> : null}{i.tipo === "s" ? <span className="muted"> · serviço</span> : null}</span>
                <span className="muted" style={{ whiteSpace: "nowrap" }}>
                  {i.tipo === "p" && i.estoque != null ? `Estoque ${i.estoque}` : ""}{i.preco != null ? ` · ${moeda(i.preco)}` : ""}
                </span>
              </span>
            </button>
          ))}
          {!achados.length && <div className="muted" style={{ padding: 8, fontSize: 13 }}>Nada encontrado. Deixe em branco e digite a descrição do item avulso.</div>}
        </div>
      )}
    </div>
  );
}
