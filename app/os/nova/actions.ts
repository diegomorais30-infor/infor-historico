"use server";
import { createClient } from "@/lib/supabase/server";

export type NovoCliente = { nome: string; celular?: string; documento?: string; telefone?: string; email?: string; tipo?: "fisica" | "juridica"; cep?: string; trade_name?: string; address?: string; street_number?: string; complement?: string; neighborhood?: string; city?: string; state?: string; contact_name?: string; notes?: string };

// Cadastro rápido de cliente durante a abertura da OS. Devolve o cliente criado (ou o já existente com o mesmo documento).
export async function criarClienteRapido(d: NovoCliente): Promise<{ id?: string; name?: string; aviso?: string; erro?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Sessão expirada. Entre novamente." };
  const t = (v?: string) => (v ?? "").trim() || null;
  const nome = t(d.nome);
  if (!nome) return { erro: "Informe o nome do cliente." };
  const documento = t(d.documento);
  if (documento) {
    const { data: ja } = await supabase.from("clients").select("id, name").eq("document", documento).limit(1);
    if (ja?.length) return { id: ja[0].id, name: ja[0].name, aviso: "Já existia um cliente com este CPF/CNPJ; ele foi selecionado." };
  }
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: nome,
      document: documento,
      mobile: t(d.celular),
      phone: t(d.telefone),
      email: t(d.email),
      cep: t(d.cep),
      trade_name: t(d.trade_name),
      address: t(d.address),
      street_number: t(d.street_number),
      complement: t(d.complement),
      neighborhood: t(d.neighborhood),
      city: t(d.city),
      state: t(d.state)?.toUpperCase().slice(0, 2) ?? null,
      contact_name: t(d.contact_name),
      notes: t(d.notes),
      person_type: d.tipo === "juridica" ? "pj" : "pf",
      origin: "Cadastro rápido",
      registered_at: new Date().toISOString(),
    })
    .select("id, name")
    .single();
  if (error || !data) return { erro: error?.message ?? "Não foi possível cadastrar o cliente." };
  return { id: data.id, name: data.name };
}
