"use client";
import { useRef, useState } from "react";

// Quadro de assinatura (mouse ou dedo). O desenho vai no campo escondido "assinatura" como imagem.
export default function Assinatura() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [valor, setValor] = useState("");
  const desenhando = useRef(false);

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * ref.current!.width) / r.width, y: ((e.clientY - r.top) * ref.current!.height) / r.height };
  };
  const ctx = () => {
    const c = ref.current!.getContext("2d")!;
    c.lineWidth = 3;
    c.lineCap = "round";
    c.strokeStyle = "#111";
    return c;
  };
  return (
    <div>
      <canvas
        ref={ref}
        width={600}
        height={200}
        style={{ width: "100%", maxWidth: 600, height: 160, background: "#fff", borderRadius: 8, touchAction: "none", border: "1px solid #888" }}
        onPointerDown={(e) => {
          desenhando.current = true;
          ref.current!.setPointerCapture(e.pointerId);
          const p = pos(e);
          const c = ctx();
          c.beginPath();
          c.moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!desenhando.current) return;
          const p = pos(e);
          const c = ctx();
          c.lineTo(p.x, p.y);
          c.stroke();
        }}
        onPointerUp={() => {
          desenhando.current = false;
          setValor(ref.current!.toDataURL("image/png"));
        }}
      />
      <input type="hidden" name="assinatura" value={valor} />
      <button
        type="button"
        className="btn secondary"
        style={{ marginTop: 6 }}
        onClick={() => {
          ref.current!.getContext("2d")!.clearRect(0, 0, 600, 200);
          setValor("");
        }}
      >
        Limpar assinatura
      </button>
    </div>
  );
}
