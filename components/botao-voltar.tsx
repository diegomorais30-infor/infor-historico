"use client";
import { usePathname, useRouter } from "next/navigation";

// Botão "Voltar" fixo na barra de cima: volta à tela anterior sem precisar do menu lateral.
export default function BotaoVoltar() {
  const router = useRouter();
  const pathname = usePathname();
  if (pathname === "/dashboard" || pathname === "/") return null;
  return (
    <button
      type="button"
      className="btn secondary"
      style={{ marginRight: "auto" }}
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/dashboard"))}
    >
      ← Voltar
    </button>
  );
}
