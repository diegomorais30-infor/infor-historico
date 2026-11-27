"use client";
import { useEffect } from "react";

const MM = 96 / 25.4;

// Escolhe o maior zoom em que as duas vias cabem na folha A4 (uma em cima da outra),
// aproveitando o máximo da página em vez de usar um tamanho fixo pequeno.
export function AjusteVias({ larguraMm, alturaMm }: { larguraMm: number; alturaMm: number }) {
  useEffect(() => {
    const ajustar = () => {
      const caixa = document.querySelector(".vias2") as HTMLElement | null;
      if (!caixa) return;
      const vias = Array.from(caixa.querySelectorAll(".via")) as HTMLElement[];
      if (!vias.length) return;
      const limite = alturaMm * MM - 6;
      let melhor = 0.5;
      for (let z = 1; z >= 0.5; z = Math.round((z - 0.02) * 100) / 100) {
        const medida = document.createElement("div");
        medida.className = "vias2";
        medida.style.cssText = `position:absolute;left:-99999px;top:0;visibility:hidden;width:${(larguraMm * MM) / z}px;zoom:1`;
        medida.style.setProperty("--zv", "1");
        const copias = vias.map((v) => v.cloneNode(true) as HTMLElement);
        copias.forEach((c) => medida.appendChild(c));
        document.body.appendChild(medida);
        const cabe = copias.every((c) => c.offsetHeight * z <= limite);
        document.body.removeChild(medida);
        if (cabe) { melhor = z; break; }
      }
      caixa.style.setProperty("--zv", String(melhor));
    };
    ajustar();
    const t = setTimeout(ajustar, 600);
    window.addEventListener("beforeprint", ajustar);
    window.addEventListener("load", ajustar);
    return () => { clearTimeout(t); window.removeEventListener("beforeprint", ajustar); window.removeEventListener("load", ajustar); };
  }, [larguraMm, alturaMm]);
  return null;
}
