"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { createClient } from "@/lib/supabase/client";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
// Só aceita QR no formato das nossas etiquetas: .../e/<código>
const PADRAO = new RegExp(`/e/(${UUID})/?$`, "i");
const PADRAO_TAG = /\/p\/[a-z0-9-]+\/([^/?#]+)\/?$/i;

export default function Leitor() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [msg, setMsg] = useState("Abrindo a câmera…");
  const [erro, setErro] = useState("");
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (!ativo) return;
    let parar = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function abrirFicha(token: string, porTag = false) {
      setMsg("QR lido. Procurando o equipamento…");
      const supabase = createClient();
      const q = supabase.from("equipment").select("id");
      const { data } = porTag
        ? await q.eq("asset_tag", token).neq("status", "inactive").limit(1).maybeSingle()
        : await q.eq("qr_token", token).maybeSingle();
      if (data?.id) {
        router.push(`/equipamentos/${data.id}`);
      } else {
        setErro("Este QR não pertence a um equipamento da sua empresa.");
        setAtivo(false);
      }
    }

    function ler() {
      if (parar) return;
      const v = videoRef.current;
      const c = canvasRef.current;
      if (v && c && v.readyState >= 2 && v.videoWidth) {
        const w = Math.min(640, v.videoWidth);
        const h = Math.round((v.videoHeight / v.videoWidth) * w);
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const r = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
          if (r?.data) {
            const m = r.data.match(PADRAO);
            if (m) {
              parar = true;
              abrirFicha(m[1].toLowerCase());
              return;
            }
            const t = r.data.match(PADRAO_TAG);
            if (t) {
              parar = true;
              abrirFicha(decodeURIComponent(t[1]), true);
              return;
            }
            setMsg("QR não reconhecido. Use a etiqueta colada na impressora.");
          }
        }
      }
      timer = setTimeout(ler, 150);
    }

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (parar) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        setMsg("Aponte para o QR Code da etiqueta.");
        ler();
      } catch {
        setErro("Não foi possível abrir a câmera. Permita o acesso à câmera nas configurações do navegador e tente de novo.");
        setAtivo(false);
      }
    })();

    return () => {
      parar = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [ativo, router]);

  return (
    <div className="card">
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000", aspectRatio: "3 / 4" }}>
        <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div
          aria-hidden="true"
          style={{ position: "absolute", inset: "20% 15%", border: "3px solid #78b8ff", borderRadius: 16, pointerEvents: "none" }}
        />
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {erro ? (
        <>
          <p className="error" style={{ marginTop: 12 }}>{erro}</p>
          <button type="button" className="btn primary" onClick={() => { setErro(""); setMsg("Abrindo a câmera…"); setAtivo(true); }}>
            Tentar de novo
          </button>
        </>
      ) : (
        <p className="muted" style={{ marginTop: 12 }}>{msg}</p>
      )}
    </div>
  );
}
