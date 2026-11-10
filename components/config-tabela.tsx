"use client";
import { useEffect, useRef, useState } from "react";

// Botão ⚙ no topo da tabela: escolhe quais colunas aparecer (guardado neste navegador).
export default function ConfigTabela({ chave }: { chave: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);
  const [cols, setCols] = useState<string[]>([]);
  const [ocultas, setOcultas] = useState<number[]>([]);
  const [pronto, setPronto] = useState(false);

  const tabela = () => ref.current?.parentElement?.querySelector("table") as HTMLTableElement | null;

  useEffect(() => {
    const t = tabela();
    if (!t) return;
    setCols([...t.querySelectorAll("thead th")].map((th) => (th as HTMLElement).innerText.trim() || "(ações)"));
    try {
      setOcultas(JSON.parse(localStorage.getItem("cols:" + chave) || "[]"));
    } catch {}
    setPronto(true);
  }, [chave]);

  useEffect(() => {
    const t = tabela();
    if (!t || !pronto) return;
    t.querySelectorAll("tr").forEach((tr) => {
      [...tr.children].forEach((c, i) => ((c as HTMLElement).style.display = ocultas.includes(i) && tr.children.length === cols.length ? "none" : ""));
    });
    try {
      localStorage.setItem("cols:" + chave, JSON.stringify(ocultas));
    } catch {}
  }, [ocultas, pronto, cols.length, chave]);

  if (!cols.length && pronto) return <div ref={ref} />;
  return (
    <div ref={ref} className="cfg-tab no-print">
      <button type="button" className="cfg-btn" onClick={() => setAberto((v) => !v)} title="Configurar colunas" aria-label="Configurar colunas">⚙</button>
      {aberto && (
        <div className="cfg-pop">
          <b style={{ fontSize: 12 }}>Colunas visíveis</b>
          {cols.map((c, i) => (
            <label key={i}>
              <input type="checkbox" checked={!ocultas.includes(i)} onChange={() => setOcultas((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]))} /> {c}
            </label>
          ))}
          <button type="button" className="btn secondary" style={{ marginTop: 6 }} onClick={() => setOcultas([])}>Mostrar todas</button>
        </div>
      )}
    </div>
  );
}
