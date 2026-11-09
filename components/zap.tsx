import { linkWhats } from "@/lib/whatsapp";

// Ícone do WhatsApp que abre a conversa (wa.me) com mensagem pronta. Não renderiza nada se não houver telefone válido.
export default function Zap({ telefone, mensagem = "Olá!", titulo = "Chamar no WhatsApp" }: { telefone?: string | null; mensagem?: string; titulo?: string }) {
  const href = linkWhats(telefone, mensagem);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={titulo} aria-label={titulo} style={{ display: "inline-flex", verticalAlign: "middle", marginLeft: 6 }}>
      <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#25D366" />
        <path fill="#fff" d="M23.2 8.7A10.1 10.1 0 0 0 6.9 20.8L5.8 26l5.3-1.4a10.1 10.1 0 0 0 4.8 1.2h0A10.1 10.1 0 0 0 23.2 8.7zM15.9 24.1a8.4 8.4 0 0 1-4.3-1.2l-.3-.2-3.1.8.8-3-.2-.3a8.4 8.4 0 1 1 7.1 3.9zm4.6-6.3c-.3-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.6.1a6.9 6.9 0 0 1-3.4-3c-.3-.4.3-.4.8-1.4.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.7 11.7 0 0 0 4.5 4c1.7.7 2.3.8 3.1.7a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .1-1.2c-.1-.1-.3-.2-.6-.3z" />
      </svg>
    </a>
  );
}
