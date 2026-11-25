"use client";
export default function BotaoImprimir() {
  return <button type="button" className="btn secondary" onClick={() => window.print()}>PDF / Imprimir</button>;
}

// Botão fixo no canto da tela: fica sempre visível (inclusive no celular) e não sai na impressão.
export function BotaoImprimirFlutuante() {
  return (
    <button
      type="button"
      className="no-print"
      onClick={() => window.print()}
      style={{ position: "fixed", right: 16, bottom: 16, zIndex: 80, border: 0, borderRadius: 999, padding: "14px 20px", fontSize: 16, fontWeight: 700, background: "#2563eb", color: "#fff", boxShadow: "0 4px 14px rgba(0,0,0,.35)", cursor: "pointer" }}
    >
      🖨 Imprimir
    </button>
  );
}
