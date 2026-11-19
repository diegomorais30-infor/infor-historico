// Traduz mensagens de erro do Supabase Auth para português claro.
export function erroSenha(msg: string): string {
  const m = (msg || "").toLowerCase();
  if (m.includes("weak") || m.includes("pwned") || m.includes("easy to guess"))
    return "Senha muito comum ou já vazada na internet. Escolha outra com 10 ou mais caracteres, misturando letras, números e símbolo, sem usar nome, datas ou sequências (ex.: 123456).";
  if (m.includes("different from the old") || m.includes("same as the old")) return "A nova senha precisa ser diferente da senha atual.";
  if (m.includes("at least") || m.includes("should be at least")) return "A senha é muito curta. Use 10 ou mais caracteres.";
  if (m.includes("already been registered") || m.includes("already registered")) return "Já existe um usuário com este e-mail.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
  return msg;
}
