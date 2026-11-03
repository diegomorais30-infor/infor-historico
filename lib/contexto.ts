import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Usuário logado + perfil + empresa. Redireciona para o login se não houver sessão.
export async function getContexto() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("full_name, role, active, company_id, companies(name, plan, trial_ends_at, max_equipment, whatsapp)")
    .eq("id", user.id)
    .single();

  return { supabase, user, perfil };
}
