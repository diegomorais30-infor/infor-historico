"use client";
import { useState, type InputHTMLAttributes } from "react";

// Campo de senha com o "olho" para mostrar/ocultar o que foi digitado.
export default function CampoSenha(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [ver, setVer] = useState(false);
  return (
    <span style={{ position: "relative", display: "block" }}>
      <input {...props} type={ver ? "text" : "password"} style={{ ...(props.style ?? {}), width: "100%", paddingRight: 44 }} />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        aria-label={ver ? "Ocultar senha" : "Mostrar senha"}
        title={ver ? "Ocultar senha" : "Mostrar senha"}
        style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", cursor: "pointer", fontSize: 18, padding: "4px 6px", lineHeight: 1 }}
      >
        {ver ? "🙈" : "👁"}
      </button>
    </span>
  );
}
