"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// No celular as tabelas viram cartões: cada célula ganha o nome da coluna (data-label) para o CSS empilhar.
function rotular() {
  document.querySelectorAll<HTMLTableElement>(".wrap table:not(.sem-grade)").forEach((t) => {
    const cab = Array.from(t.querySelectorAll("thead th")).map((th) => (th.textContent ?? "").trim());
    if (!cab.length) return;
    t.classList.add("empilha");
    t.querySelectorAll("tbody tr").forEach((tr) => {
      let i = 0;
      Array.from(tr.children).forEach((td) => {
        const span = Number((td as HTMLTableCellElement).colSpan || 1);
        if (!td.hasAttribute("data-label")) td.setAttribute("data-label", span > 1 ? "" : cab[i] ?? "");
        i += span;
      });
    });
  });
}

export default function TabelasMoveis() {
  const caminho = usePathname();
  useEffect(() => {
    rotular();
    let t: ReturnType<typeof setTimeout> | undefined;
    const obs = new MutationObserver(() => { clearTimeout(t); t = setTimeout(rotular, 120); });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => { obs.disconnect(); clearTimeout(t); };
  }, [caminho]);
  return null;
}
