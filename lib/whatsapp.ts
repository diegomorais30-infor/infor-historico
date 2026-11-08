// Link de conversa do WhatsApp (wa.me) com mensagem pronta. Aceita telefone com máscara; adiciona o 55 do Brasil.
export function linkWhats(telefone: string | null | undefined, mensagem: string): string | null {
  const n = String(telefone ?? "").replace(/\D/g, "");
  if (n.length < 10) return null;
  const completo = n.length <= 11 ? `55${n}` : n;
  return `https://wa.me/${completo}?text=${encodeURIComponent(mensagem)}`;
}
