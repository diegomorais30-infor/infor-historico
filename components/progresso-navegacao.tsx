"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Barra no topo + véu com a logo assim que o usuário clica num link interno ou envia um formulário.
export default function ProgressoNavegacao() {
  const [ativo, setAtivo] = useState(false);
  const caminho = usePathname();
  const busca = useSearchParams().toString();

  useEffect(() => { setAtivo(false); }, [caminho, busca]);

  useEffect(() => {
    const clique = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a") as HTMLAnchorElement | null;
      if (!a || !a.href || a.target === "_blank" || a.hasAttribute("download")) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin) return;
      if (u.pathname === location.pathname && u.search === location.search) return;
      setAtivo(true);
    };
    const envio = (e: Event) => {
      const f = e.target as HTMLFormElement | null;
      if (f && !e.defaultPrevented && (f.getAttribute("method") ?? "get").toLowerCase() !== "dialog") setAtivo(true);
    };
    document.addEventListener("click", clique);
    document.addEventListener("submit", envio);
    return () => { document.removeEventListener("click", clique); document.removeEventListener("submit", envio); };
  }, []);

  if (!ativo) return null;
  return (
    <>
      <div className="nav-barra" />
      <div className="nav-veu" aria-hidden><div className="carregando-logo"><svg width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0F2A4F" stroke="#223C63" strokeWidth="1.5" /><circle cx="23" cy="38" r="13" fill="#FFC800" /><circle cx="41" cy="38" r="13" fill="#2F7DE1" fillOpacity=".9" /><circle cx="32" cy="23" r="13" fill="#E5197B" fillOpacity=".9" /></svg></div><div className="carregando-texto">Carregando…</div></div>
    </>
  );
}
