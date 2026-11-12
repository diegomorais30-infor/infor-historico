import Link from "next/link";
import { notFound } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { STATUS_EQUIPAMENTO, TIPOS_MANUTENCAO, fmtData } from "@/lib/format";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { podeEditar } from "@/lib/permissoes";
import QR from "./qr";

async function removerPatrimonio(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("equipment").update({ asset_tag: null }).eq("id", id);
  revalidatePath(`/equipamentos/${id}`);
  redirect(`/equipamentos/${id}`);
}

async function salvarVinculo(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const vinculo = String(formData.get("vinculo")) === "contrato" ? "contrato" : "avulso";
  const supabase = await createClient();
  await supabase.from("equipment").update({ vinculo }).eq("id", id);
  revalidatePath(`/equipamentos/${id}`);
  redirect(`/equipamentos/${id}`);
}

// Cliente avulso: o código/QR só é liberado quando houver aceite (do cliente ou nosso) para colar a etiqueta.
async function aceitarEtiqueta(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("equipment").update({ label_accepted: true }).eq("id", id);
  revalidatePath(`/equipamentos/${id}`);
  redirect(`/equipamentos/${id}`);
}

// Só administrador; só equipamento de cliente avulso (sem contrato) — não é patrimônio nosso.
async function excluirEquipamento(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const { supabase, perfil } = await getContexto();
  const volta = `/equipamentos/${id}`;
  if (perfil?.role !== "admin") redirect(volta);
  const { data: eq } = await supabase.from("equipment").select("contract_id, vinculo").eq("id", id).single();
  if (!eq || eq.contract_id || eq.vinculo !== "avulso") redirect(`/equipamentos?aviso=${encodeURIComponent("Só é possível excluir equipamentos de clientes avulsos (sem contrato).")}`);
  await supabase.from("os_equipment").delete().eq("equipment_id", id);
  const { error } = await supabase.from("equipment").delete().eq("id", id);
  revalidatePath("/equipamentos");
  redirect(`/equipamentos?aviso=${encodeURIComponent(error ? "Não foi possível excluir: " + error.message : "Equipamento excluído.")}`);
}

export default async function DetalheEquipamento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, perfil } = await getContexto();
  const editar = podeEditar(perfil?.role, perfil?.permissions, "equipamentos");

  const { data: e } = await supabase.from("equipment").select("*,clients(name)").eq("id", id).single();
  if (!e) notFound();
  const { data: emp } = await supabase.from("companies").select("slug").maybeSingle();

  const { data: manutencoes } = await supabase
    .from("maintenance")
    .select(
      "*, maintenance_parts(quantity, parts(name, code)), maintenance_files(id, storage_path, file_name, file_type)"
    )
    .eq("equipment_id", id)
    .order("service_date", { ascending: false });

  const lista: any[] = manutencoes ?? [];

  // Nome dos técnicos (a manutenção guarda só o id)
  const idsTecnicos = [...new Set(lista.map((m) => m.technician_id).filter(Boolean))];
  const nomes: Record<string, string> = {};
  if (idsTecnicos.length) {
    const { data: perfis } = await supabase.from("profiles").select("id, full_name").in("id", idsTecnicos);
    (perfis ?? []).forEach((p: any) => (nomes[p.id] = p.full_name || "Sem nome"));
  }

  // Links temporários (1 hora) para fotos e PDFs
  const caminhos = lista.flatMap((m) => (m.maintenance_files ?? []).map((f: any) => f.storage_path));
  const urls: Record<string, string> = {};
  if (caminhos.length) {
    const { data: assinadas } = await supabase.storage.from("maintenance-files").createSignedUrls(caminhos, 3600);
    (assinadas ?? []).forEach((a: any) => {
      if (a.path && a.signedUrl) urls[a.path] = a.signedUrl;
    });
  }

  return (
    <main className="wrap">
      <Link href="/equipamentos" className="muted">
        ← Equipamentos
      </Link>
      <div className="headrow" style={{ margin: "14px 0 18px" }}>
        <div>
          <div className="muted">{e.code}</div>
          <h1 className="title">
            {e.brand} {e.model}
          </h1>
          <div className="muted">
            {(e as any).clients?.name ?? "—"} · {e.location ?? "—"}
          </div>
          <div style={{ marginTop: 10 }}>
            <span className="badge">{STATUS_EQUIPAMENTO[e.status] ?? e.status}</span>
          </div>
        </div>
        {(e as any).vinculo === "contrato" || (e as any).label_accepted ? (
          <QR code={e.code} token={e.qr_token} tag={e.asset_tag} slug={(emp as any)?.slug ?? null} />
        ) : (
          <div className="card" style={{ maxWidth: 280 }}>
            <b>Equipamento de cliente avulso</b>
            <p className="muted" style={{ margin: "6px 0" }}>O código/QR só é gerado se o cliente (ou a Infor) aceitar colar a etiqueta.</p>
            {editar && (
              <form action={aceitarEtiqueta}>
                <input type="hidden" name="id" value={e.id} />
                <button className="btn primary" type="submit">Aceitou a etiqueta — gerar código</button>
              </form>
            )}
          </div>
        )}
      </div>

      <form action={salvarVinculo} className="card" style={{ marginBottom: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input type="hidden" name="id" value={e.id} />
        <b>Vínculo:</b>
        <select name="vinculo" defaultValue={(e as any).vinculo ?? "avulso"} disabled={!editar || !!e.contract_id}>
          <option value="contrato">Contrato</option>
          <option value="avulso">Avulso (cliente que presta serviço)</option>
        </select>
        {editar && !e.contract_id && <button className="btn secondary" type="submit">Salvar</button>}
        <span className="muted">{e.contract_id ? "Ligado a um contrato." : "Cliente voltou? O histórico de manutenção fica sempre guardado."}</span>
      </form>

      <div className="grid g4">
        <div className="card">
          <div className="muted">Nº série</div>
          <b>{e.serial_number ?? "—"}</b>
        </div>
        <div className="card">
          <div className="muted">Patrimônio</div>
          <b>{e.asset_tag ?? "—"}</b>
          {editar && e.asset_tag ? (
            <form action={removerPatrimonio} style={{ marginTop: 6 }}>
              <input type="hidden" name="id" value={e.id} />
              <button className="btn secondary" type="submit">Remover patrimônio</button>
            </form>
          ) : null}
        </div>
        <div className="card">
          <div className="muted">Instalação</div>
          <b>{fmtData(e.installation_date)}</b>
        </div>
        <div className="card">
          <div className="muted">Próxima preventiva</div>
          <b>{fmtData(e.next_preventive_date)}</b>
        </div>
      </div>

      {perfil?.role === "admin" && (e as any).vinculo === "avulso" && !e.contract_id && (
        <form action={excluirEquipamento} className="card" style={{ marginTop: 18, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input type="hidden" name="id" value={e.id} />
          <span className="muted" style={{ flex: 1, minWidth: 220 }}>Máquina de cliente avulso (não é patrimônio da Infor). Excluir apaga também o histórico de manutenções e leituras deste equipamento.</span>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="confirmo" required /> Confirmo</label>
          <button className="btn secondary" type="submit" style={{ color: "#b91c1c" }}>🗑 Excluir equipamento</button>
        </form>
      )}

      <section className="card" style={{ marginTop: 18 }}>
        <div className="headrow">
          <h2 style={{ margin: 0 }}>Histórico de manutenções</h2>
          <Link className="btn primary" href={`/equipamentos/${id}/manutencao/nova`}>
            + Registrar manutenção
          </Link>
        </div>

        <div style={{ marginTop: 16 }}>
          {lista.map((m) => (
            <article className="history" key={m.id}>
              <b>{TIPOS_MANUTENCAO[m.maintenance_type] ?? m.maintenance_type}</b>
              <div className="muted">
                {fmtData(m.service_date)} · O.S. {m.os_number ?? "—"} · Técnico:{" "}
                {m.technician_id ? nomes[m.technician_id] ?? "—" : "—"}
              </div>
              {m.problem_reported && (
                <p>
                  <b>Problema:</b> {m.problem_reported}
                </p>
              )}
              {m.diagnosis && (
                <p>
                  <b>Diagnóstico:</b> {m.diagnosis}
                </p>
              )}
              <p>
                <b>Serviço:</b> {m.service_performed ?? "—"}
              </p>
              {(m.maintenance_parts ?? []).length > 0 && (
                <p>
                  <b>Peças:</b>{" "}
                  {m.maintenance_parts.map((p: any) => `${p.quantity}× ${p.parts?.name ?? "peça"}`).join(", ")}
                </p>
              )}
              {m.observations && <p className="muted">{m.observations}</p>}
              {(m.maintenance_files ?? []).length > 0 && (
                <div className="filesrow">
                  {m.maintenance_files.map((f: any) =>
                    urls[f.storage_path] ? (
                      <a key={f.id} href={urls[f.storage_path]} target="_blank" rel="noreferrer">
                        {f.file_type?.startsWith("image/") ? (
                          <img src={urls[f.storage_path]} alt={f.file_name ?? "foto"} className="thumb" />
                        ) : (
                          <span className="btn secondary">{f.file_name ?? "Arquivo"}</span>
                        )}
                      </a>
                    ) : null
                  )}
                </div>
              )}
            </article>
          ))}
          {!lista.length && <p className="muted">Nenhuma manutenção registrada ainda.</p>}
        </div>
      </section>
    </main>
  );
}
