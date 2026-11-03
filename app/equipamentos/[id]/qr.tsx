"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QR({ code, token }: { code: string; token: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    // Endereço fixo (domínio próprio) quando configurado; senão usa o endereço atual.
    const base = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "");
    QRCode.toDataURL(`${base}/e/${token}`, { width: 180, margin: 2 }, (err, url) => {
      if (!err) setSrc(url);
    });
  }, [token]);

  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>QR Code</div>
      {src && <img src={src} alt={`QR Code ${code}`} width={180} height={180} />}
      <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>
        {code}
      </div>
    </div>
  );
}
