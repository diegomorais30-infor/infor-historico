import { lerConfig } from "@/lib/config";
import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { PRIORIDADE_OS } from "@/lib/os";
import { podeEditar } from "@/lib/permissoes";
import { vazioParaNulo } from "@/lib/format";
import SeletorCliente from "@/components/seletor-cliente";

async function criar(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cfgPrazo = (await lerConfig(supabase)).prazo_os_dias;
  const client_id = String(formData.get("client_id") || "");
  if (!client_id) redirect("/os/nova?erro=" + encodeURIComponent("Escolha o cliente."));

  const dados = vazioParaNulo({
    client_id,
    equipment_id: String(formData.get("equipment_id") || ""),
    service_request_id: String(formData.get("service_request_id") || ""),
    priority: String(formData.get("priority") || "normal"),
    deadline: String(formData.get("deadline") || "") || (cfgPrazo > 0 ? new Date(Date.now() + cfgPrazo * 86400000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) : ""),
    technician_id: String(formData.get("technician_id") || ""),
    defect: String(formData.get("defect") || ""),
    contact_name: String(formData.get("contact_name") || ""),
    atendimento: formData.get("atendimento") === "assistencia" ? "assistencia" : "externo",
  });
  const { data, error } = await supabase.from("service_orders").insert(dados).select("id").single();
  if (error || !data) redirect("/os/nova?erro=" + encodeURIComponent(error?.message ?? "Não foi possível criar a OS."));
  redirect(`/os/${data.id}`);
}

export default async function NovaOS({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; equipamento?: string; chamado?: string }>;
}) {
  const { erro, equipamento, chamado } = await searchParams;
  const { supabase, perfil } = await getContexto();
  if (!podeEditar(perfil?.role, (perfil as any)?.permissions, "os")) redirect("/os");

  const [{ data: clientes }, { data: equipamentos }, { data: equipe }] = await Promise.all([
    supabase.from("clients").select("id, name, document").eq("active", true).order("name").limit(5000),
    supabase.from("equipment").select("id, code, brand, model, client_id").order("code"),
    supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name"),
  ]);

  let eqInicial = equipamento ?? "";
  let defeito = "";
  if (chamado) {
    const { data: ch } = await supabase.from("service_requests").select("equipment_id, description").eq("id", chamado).single();
    if (ch) {
      eqInicial = eqInicial || (ch as any).equipment_id || "";
      defeito = (ch as any).description ?? "";
    }
  }
  const eq: any = (equipamentos ?? []).find((e: any) => e.id === eqInicial);

  return (
    <main className="wrap">
      <h1 className="title">Nova ordem de serviço</h1>
      {erro && <div className="error" style={{ margin: "14px 0" }}>{erro}</div>}
      <form action={criar} className="card grid g2" style={{ marginTop: 14 }}>
        <input type="hidden" name="service_request_id" value={chamado ?? ""} />
        <div className="field">
          Cliente
          <SeletorCliente clientes={(clientes ?? []) as any} inicial={eq?.client_id ?? ""} />
        </div>
        <label className="field">
          Equipamento (opcional)
          <select name="equipment_id" defaultValue={eqInicial}>
            <option value="">Sem equipamento</option>
            {(equipamentos ?? []).map((e: any) => (
              <option key={e.id} value={e.id}>
                {e.code} · {e.brand ?? ""} {e.model ?? ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Atendimento
          <select name="atendimento" defaultValue="externo">
            <option value="externo">Externo (vai para o painel)</option>
            <option value="assistencia">Na assistência</option>
          </select>
        </label>
        <label className="field">
          Prioridade
          <select name="priority" defaultValue="normal">
            {Object.entries(PRIORIDADE_OS).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Prazo
          <input name="deadline" type="date" />
        </label>
        <label className="field">
          Técnico responsável
          <select name="technician_id" defaultValue="">
            <option value="">Ninguém ainda</option>
            {(equipe ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.full_name || "Sem nome"}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Solicitante
          <input name="contact_name" placeholder="Quem trouxe o equipamento" />
        </label>
        <label className="field" style={{ gridColumn: "1/-1" }}>
          Defeito relatado
          <textarea name="defect" rows={3} defaultValue={defeito} />
        </label>
        <div style={{ gridColumn: "1/-1" }}>
          <button className="btn primary">Criar OS</button>
        </div>
      </form>
    </main>
  );
}
