"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function chave(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Estado = "carregando" | "sem-suporte" | "ios-instalar" | "bloqueado" | "desligado" | "ligado";

// Liga ou desliga os avisos de novos chamados neste aparelho.
export default function AvisosPush() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const instalado =
        window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setEstado(ios && !instalado ? "ios-instalar" : "sem-suporte");
        return;
      }
      if (Notification.permission === "denied") return setEstado("bloqueado");
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setEstado(sub && Notification.permission === "granted" ? "ligado" : "desligado");
      } catch {
        setEstado("desligado");
      }
    })();
  }, []);

  async function ativar() {
    setErro("");
    setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado(permissao === "denied" ? "bloqueado" : "desligado");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const antiga = await reg.pushManager.getSubscription();
      const sub =
        antiga ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: chave(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as unknown as BufferSource,
        }));
      const j = sub.toJSON();
      const supabase = createClient();
      const { error } = await supabase.rpc("push_registrar", {
        p_endpoint: j.endpoint,
        p_p256dh: j.keys?.p256dh,
        p_auth: j.keys?.auth,
      });
      if (error) throw error;
      setEstado("ligado");
    } catch {
      setErro("Não foi possível ativar os avisos. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  async function desativar() {
    setErro("");
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await createClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setEstado("desligado");
    } catch {
      setErro("Não foi possível desativar. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  if (estado === "carregando" || estado === "sem-suporte") return null;

  return (
    <section className="card no-print" style={{ marginBottom: 18 }}>
      <div className="headrow">
        <div>
          <strong>Avisos de novos chamados</strong>
          <div className="muted" style={{ fontSize: 13 }}>
            {estado === "ligado" && "Ativados neste aparelho. Você recebe um aviso quando um cliente abrir um chamado."}
            {estado === "desligado" && "Receba um aviso no celular quando um cliente abrir um chamado pelo QR Code."}
            {estado === "bloqueado" && "As notificações estão bloqueadas. Libere nas configurações do navegador para este site."}
            {estado === "ios-instalar" && "No iPhone, primeiro instale o app: toque em Compartilhar e em “Adicionar à Tela de Início”. Depois abra o app e ative os avisos."}
          </div>
          {erro && <div className="error" style={{ marginTop: 6 }}>{erro}</div>}
        </div>
        {estado === "desligado" && (
          <button type="button" className="btn primary" disabled={ocupado} onClick={ativar}>
            {ocupado ? "Ativando…" : "Ativar avisos"}
          </button>
        )}
        {estado === "ligado" && (
          <button type="button" className="btn secondary" disabled={ocupado} onClick={desativar}>
            Desativar
          </button>
        )}
      </div>
    </section>
  );
}
