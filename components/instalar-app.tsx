"use client";

import { useEffect, useState } from "react";

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Registra o service worker e mostra um convite para instalar o app (Android/Chrome)
// ou a instrução de "Adicionar à Tela de Início" (iPhone).
export default function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [ios, setIos] = useState(false);
  const [oculto, setOculto] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

    const instalado =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    let dispensado = false;
    try {
      dispensado = localStorage.getItem("instalar-app-dispensado") === "1";
    } catch {}
    if (instalado || dispensado) return;

    const eIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (eIos) {
      setIos(true);
      setOculto(false);
    }
    const aoReceber = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
      setOculto(false);
    };
    window.addEventListener("beforeinstallprompt", aoReceber);
    return () => window.removeEventListener("beforeinstallprompt", aoReceber);
  }, []);

  function dispensar() {
    setOculto(true);
    try {
      localStorage.setItem("instalar-app-dispensado", "1");
    } catch {}
  }

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice;
    setEvento(null);
    setOculto(true);
  }

  if (oculto || (!evento && !ios)) return null;

  return (
    <div
      className="no-print card"
      style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 50, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}
    >
      <div style={{ flex: "1 1 200px" }}>
        <strong>Instalar o app</strong>
        <div className="muted" style={{ fontSize: 13 }}>
          {ios ? "Toque em Compartilhar e depois em “Adicionar à Tela de Início”." : "Abra o InforGest direto da tela do celular."}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {!ios && (
          <button type="button" className="btn primary" onClick={instalar}>
            Instalar
          </button>
        )}
        <button type="button" className="btn secondary" onClick={dispensar}>
          Agora não
        </button>
      </div>
    </div>
  );
}
