import { createClient } from "@supabase/supabase-js";

// Cliente com a chave de serviço: SÓ no servidor, para criar contas da equipe.
// Nunca importe este arquivo em componente de cliente.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
