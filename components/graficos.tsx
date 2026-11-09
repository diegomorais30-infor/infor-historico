// Gráficos simples em SVG puro (sem biblioteca), pensados para ficar dentro de cartões azuis.
import { moeda } from "@/lib/format";

export const PALETA = ["#4ea1ff", "#f6c500", "#3ccf91", "#ff7a7a", "#b48cff", "#ff9f43", "#5fd0e0", "#9db0c9"];

const TXT = "var(--ink)";
const SUAVE = "var(--muted)";
const GRADE = "var(--line)";

const curto = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (a >= 1000) return `${(v / 1000).toFixed(a >= 10000 ? 0 : 1).replace(".", ",")} mil`;
  return String(Math.round(v));
};

export type Serie = { nome: string; cor: string; valores: number[] };

// Barras verticais agrupadas (uma barra por série em cada categoria)
export function Barras({ categorias, series, dinheiro = false, altura = 220 }: { categorias: string[]; series: Serie[]; dinheiro?: boolean; altura?: number }) {
  const W = 560, H = altura, ml = 44, mb = 26, mt = 10, mr = 8;
  const max = Math.max(1, ...series.flatMap((s) => s.valores));
  const passos = 4;
  const area = H - mb - mt;
  const larg = (W - ml - mr) / Math.max(1, categorias.length);
  const bw = Math.min(28, (larg - 8) / series.length);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img">
        {Array.from({ length: passos + 1 }, (_, i) => {
          const y = mt + area - (area * i) / passos;
          return (
            <g key={i}>
              <line x1={ml} x2={W - mr} y1={y} y2={y} stroke={GRADE} strokeWidth={1} />
              <text x={ml - 6} y={y + 4} textAnchor="end" fontSize={11} fill={SUAVE}>{curto((max * i) / passos)}</text>
            </g>
          );
        })}
        {categorias.map((c, ci) => {
          const x0 = ml + ci * larg + (larg - bw * series.length) / 2;
          return (
            <g key={c + ci}>
              {series.map((s, si) => {
                const v = s.valores[ci] ?? 0;
                const h = (v / max) * area;
                return (
                  <rect key={si} x={x0 + si * bw} y={mt + area - h} width={bw - 2} height={Math.max(h, v > 0 ? 1 : 0)} rx={3} fill={s.cor}>
                    <title>{`${s.nome} — ${c}: ${dinheiro ? moeda(v) : v}`}</title>
                  </rect>
                );
              })}
              <text x={ml + ci * larg + larg / 2} y={H - 8} textAnchor="middle" fontSize={11} fill={SUAVE}>{c}</text>
            </g>
          );
        })}
      </svg>
      <Legenda itens={series.map((s) => ({ nome: s.nome, cor: s.cor }))} />
    </div>
  );
}

// Linha com área (uma ou mais séries)
export function Linhas({ categorias, series, dinheiro = false, altura = 220 }: { categorias: string[]; series: Serie[]; dinheiro?: boolean; altura?: number }) {
  const W = 560, H = altura, ml = 44, mb = 26, mt = 10, mr = 12;
  const max = Math.max(1, ...series.flatMap((s) => s.valores));
  const area = H - mb - mt;
  const n = categorias.length;
  const px = (i: number) => ml + (n <= 1 ? 0 : (i * (W - ml - mr)) / (n - 1));
  const py = (v: number) => mt + area - (v / max) * area;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img">
        {[0, 1, 2, 3, 4].map((i) => {
          const y = mt + area - (area * i) / 4;
          return (
            <g key={i}>
              <line x1={ml} x2={W - mr} y1={y} y2={y} stroke={GRADE} />
              <text x={ml - 6} y={y + 4} textAnchor="end" fontSize={11} fill={SUAVE}>{curto((max * i) / 4)}</text>
            </g>
          );
        })}
        {series.map((s, si) => {
          const pts = s.valores.map((v, i) => `${px(i)},${py(v)}`);
          return (
            <g key={si}>
              <polygon points={`${px(0)},${mt + area} ${pts.join(" ")} ${px(n - 1)},${mt + area}`} fill={s.cor} opacity={0.15} />
              <polyline points={pts.join(" ")} fill="none" stroke={s.cor} strokeWidth={2.5} strokeLinejoin="round" />
              {s.valores.map((v, i) => (
                <circle key={i} cx={px(i)} cy={py(v)} r={3.5} fill={s.cor}>
                  <title>{`${s.nome} — ${categorias[i]}: ${dinheiro ? moeda(v) : v}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {categorias.map((c, i) => (
          <text key={i} x={px(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={SUAVE}>{c}</text>
        ))}
      </svg>
      <Legenda itens={series.map((s) => ({ nome: s.nome, cor: s.cor }))} />
    </div>
  );
}

// Rosca com legenda (valor e percentual)
export function Rosca({ itens, dinheiro = false, centro }: { itens: { nome: string; valor: number; cor?: string }[]; dinheiro?: boolean; centro?: string }) {
  const lista = itens.filter((i) => i.valor > 0);
  const total = lista.reduce((t, i) => t + i.valor, 0);
  const R = 70, r = 44, C = 90;
  let ang = -Math.PI / 2;
  const fatias = lista.map((it, i) => {
    const a = (it.valor / total) * Math.PI * 2;
    const a2 = ang + a;
    const grande = a > Math.PI ? 1 : 0;
    const p = (rr: number, aa: number) => `${C + rr * Math.cos(aa)} ${C + rr * Math.sin(aa)}`;
    const d = lista.length === 1
      ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} L ${C - 0.01} ${C - r} A ${r} ${r} 0 1 0 ${C} ${C - r} Z`
      : `M ${p(R, ang)} A ${R} ${R} 0 ${grande} 1 ${p(R, a2)} L ${p(r, a2)} A ${r} ${r} 0 ${grande} 0 ${p(r, ang)} Z`;
    ang = a2;
    return { d, cor: it.cor ?? PALETA[i % PALETA.length], ...it };
  });
  if (!total) return <div style={{ color: SUAVE }}>Sem dados.</div>;
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <svg viewBox="0 0 180 180" style={{ width: 170, height: 170, flex: "0 0 auto" }} role="img">
        {fatias.map((f, i) => (
          <path key={i} d={f.d} fill={f.cor}>
            <title>{`${f.nome}: ${dinheiro ? moeda(f.valor) : f.valor}`}</title>
          </path>
        ))}
        <text x={C} y={C - 2} textAnchor="middle" fontSize={centro ? 15 : 20} fontWeight={800} fill={TXT}>{centro ?? total}</text>
        <text x={C} y={C + 16} textAnchor="middle" fontSize={11} fill={SUAVE}>total</text>
      </svg>
      <div style={{ flex: "1 1 140px", fontSize: 13, display: "grid", gap: 5 }}>
        {fatias.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: f.cor, flex: "0 0 auto" }} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nome}</span>
            <b>{dinheiro ? moeda(f.valor) : f.valor}</b>
            <span style={{ color: SUAVE, width: 38, textAlign: "right" }}>{Math.round((f.valor / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Barras horizontais (ranking)
export function BarrasH({ itens, dinheiro = false, cor = "#4ea1ff" }: { itens: { nome: string; valor: number }[]; dinheiro?: boolean; cor?: string }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  if (!itens.length) return <div style={{ color: SUAVE }}>Sem dados.</div>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {itens.map((it, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.nome}</span>
            <b>{dinheiro ? moeda(it.valor) : it.valor}</b>
          </div>
          <div style={{ background: "var(--soft)", borderRadius: 4, height: 8, marginTop: 3 }}>
            <div style={{ width: `${(it.valor / max) * 100}%`, background: cor, height: 8, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Indicador (meia-lua) de percentual
export function Medidor({ pct, rotulo, cor = "#3ccf91" }: { pct: number; rotulo: string; cor?: string }) {
  const p = Math.max(0, Math.min(100, pct));
  const R = 60, C = 80;
  const a = Math.PI * (1 - p / 100);
  const x = C + R * Math.cos(a), y = C - R * Math.sin(a);
  return (
    <svg viewBox="0 0 160 100" style={{ width: "100%", maxWidth: 220, display: "block", margin: "0 auto" }} role="img">
      <path d={`M ${C - R} ${C} A ${R} ${R} 0 0 1 ${C + R} ${C}`} fill="none" stroke={GRADE} strokeWidth={14} strokeLinecap="round" />
      {p > 0 && <path d={`M ${C - R} ${C} A ${R} ${R} 0 ${p > 50 ? 1 : 0} 1 ${x} ${y}`} fill="none" stroke={cor} strokeWidth={14} strokeLinecap="round" />}
      <text x={C} y={C - 8} textAnchor="middle" fontSize={22} fontWeight={800} fill={TXT}>{Math.round(p)}%</text>
      <text x={C} y={C + 12} textAnchor="middle" fontSize={11} fill={SUAVE}>{rotulo}</text>
    </svg>
  );
}

export function Legenda({ itens }: { itens: { nome: string; cor: string }[] }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", fontSize: 12, color: SUAVE, marginTop: 6 }}>
      {itens.map((i) => (
        <span key={i.nome} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: i.cor }} />
          {i.nome}
        </span>
      ))}
    </div>
  );
}

// Cartão de indicador com faixa colorida (como os do Inforos)
export function Indicador({ titulo, valor, sub, cor = "#4ea1ff", href }: { titulo: string; valor: string; sub?: string; cor?: string; href?: string }) {
  const corpo = (
    <div className="card" style={{ borderLeft: `5px solid ${cor}`, height: "100%" }}>
      <div className="muted" style={{ fontSize: 13 }}>{titulo}</div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{valor}</div>
      {sub && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  );
  return href ? <a href={href} style={{ display: "block", color: "inherit" }}>{corpo}</a> : corpo;
}
