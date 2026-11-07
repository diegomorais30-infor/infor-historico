"use client";

export default function BotaoImprimir() {
  return (
    <button className="btn primary" onClick={() => window.print()}>
      Imprimir / salvar em PDF
    </button>
  );
}
