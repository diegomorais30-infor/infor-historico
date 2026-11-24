"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const PRESETS: [string, string][] = [
  ["mes", "Este mês"],
  ["mes_anterior", "Mês passado"],
  ["semana", "Esta semana"],
  ["30d", "Últimos 30 dias"],
  ["trimestre", "Últimos 3 meses"],
  ["ano", "Este ano"],
  ["personalizado", "Personalizado"],
];

// Seletor de período, comparar com o período anterior, atualização automática e tela cheia
export default function Controles({ p, de, ate, comparar }: { p: string; de: string; ate: string; comparar: boolean }) {
  const router = useRouter();
  const [preset, setPreset] = useState(p);
  const [hora, setHora] = useState("");

  useEffect(() => {
    const agora = () => setHora(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    agora();
    const t = setInterval(() => { router.refresh(); agora(); }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [router]);

  const ir = (q: Record<string, string>) => {
    const u = new URLSearchParams(q);
    router.push(`/painel?${u.toString()}`);
  };
  const aplicar = (novo: string, d = de, a = ate, c = comparar) => {
    const q: Record<string, string> = { p: novo };
    if (novo === "personalizado") { q.de = d; q.ate = a; }
    if (c) q.comparar = "1";
    ir(q);
  };
  const telaCheia = () => {
    const el = document.getElementById("painel-gestao") ?? document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <select value={preset} onChange={(e) => { setPreset(e.target.value); if (e.target.value !== "personalizado") aplicar(e.target.value); }} style={{ width: "auto" }} aria-label="Período">
        {PRESETS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
      </select>
      {preset === "personalizado" && (
        <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); aplicar("personalizado", String(f.get("de")), String(f.get("ate"))); }} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="date" name="de" defaultValue={de} required style={{ width: "auto" }} />
          <span className="muted">a</span>
          <input type="date" name="ate" defaultValue={ate} required style={{ width: "auto" }} />
          <button className="btn secondary" type="submit">Aplicar</button>
        </form>
      )}
      <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
        <input type="checkbox" checked={comparar} onChange={(e) => aplicar(preset, de, ate, e.target.checked)} style={{ width: "auto" }} />
        Comparar com o período anterior
      </label>
      <button type="button" className="btn secondary" onClick={telaCheia}>Tela cheia</button>
      <span className="muted" style={{ fontSize: 12 }}>{hora && `atualizado às ${hora} · atualiza sozinho a cada 5 min`}</span>
    </div>
  );
}
