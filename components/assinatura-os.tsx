"use client";
import { useEffect, useRef, useState } from "react";

// Quadro de assinatura (dedo ou mouse). Envia a imagem em PNG no campo "data".
export default function AssinaturaOS({ action, orderId }: { action: (fd: FormData) => void | Promise<void>; orderId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [desenhou, setDesenhou] = useState(false);
  const [data, setData] = useState("");
  const pintando = useRef(false);

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * ref.current!.width, y: ((e.clientY - r.top) / r.height) * ref.current!.height };
  }
  function ini(e: React.PointerEvent<HTMLCanvasElement>) {
    pintando.current = true;
    ref.current!.setPointerCapture(e.pointerId);
    const ctx = ref.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!pintando.current) return;
    const ctx = ref.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setDesenhou(true);
  }
  function fim() {
    if (!pintando.current) return;
    pintando.current = false;
    setData(ref.current!.toDataURL("image/png"));
  }
  function limpar() {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setDesenhou(false);
    setData("");
  }

  return (
    <form action={action}>
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="data" value={data} />
      <canvas
        ref={ref}
        width={700}
        height={240}
        onPointerDown={ini}
        onPointerMove={mover}
        onPointerUp={fim}
        onPointerLeave={fim}
        style={{ width: "100%", maxWidth: 700, height: 180, background: "#fff", border: "1px dashed #94a3b8", borderRadius: 8, touchAction: "none" }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" className="btn secondary" onClick={limpar}>Limpar</button>
        <button className="btn primary" disabled={!desenhou || !data}>Salvar assinatura</button>
      </div>
    </form>
  );
}
