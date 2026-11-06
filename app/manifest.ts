import type { MetadataRoute } from "next";
import { NOME_PRODUTO } from "@/lib/marca";

// Torna o sistema instalável como aplicativo (PWA).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: NOME_PRODUTO,
    short_name: NOME_PRODUTO,
    description: "Gestão de locação, manutenção e vendas",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a1a33",
    theme_color: "#0a1a33",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
