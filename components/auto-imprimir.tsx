"use client";
import { useEffect } from "react";

// Abre a janela de impressão assim que a página carrega (usado com ?auto=1).
export default function AutoImprimir() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);
  return null;
}
