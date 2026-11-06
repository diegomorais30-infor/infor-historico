import { NOME_PRODUTO } from "@/lib/marca";

// Ícone: três círculos (amarelo, azul, magenta) dentro de um quadrado azul marinho.
export function LogoIcone({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={NOME_PRODUTO}>
      <rect width="64" height="64" rx="14" fill="#0F2A4F" stroke="#223C63" strokeWidth="1.5" />
      <circle cx="23" cy="38" r="13" fill="#FFC800" />
      <circle cx="41" cy="38" r="13" fill="#2F7DE1" fillOpacity="0.9" />
      <circle cx="32" cy="23" r="13" fill="#E5197B" fillOpacity="0.9" />
    </svg>
  );
}

// Ícone + nome, com as cores da marca legíveis no fundo azul marinho.
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <>
      <LogoIcone size={size} />
      <span style={{ fontWeight: 800, letterSpacing: ".2px" }}>
        <span style={{ color: "#78B8FF" }}>Infor</span>
        <span style={{ color: "#FF6FB0" }}>{NOME_PRODUTO.replace(/^Infor/, "")}</span>
      </span>
    </>
  );
}
