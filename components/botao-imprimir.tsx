"use client";
export default function BotaoImprimir() {
  return <button type="button" className="btn secondary" onClick={() => window.print()}>PDF / Imprimir</button>;
}
