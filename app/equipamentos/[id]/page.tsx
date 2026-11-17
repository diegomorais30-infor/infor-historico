import Link from "next/link";
import { notFound } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { STATUS_EQUIPAMENTO, TIPOS_MANUTENCAO, fmtData, vazioParaNulo } from "@/lib/format";
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

async function salvarDados(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const supabase = await createClient();
  const g = (k: string) => String(formData.get(k) ?? "").trim();
  const dados = vazioParaNulo({
    client_id: g("client_id"),
    equipment_type: g("equipment_type"),
    brand: g("brand"),
    model: g("model"),
    serial_number: g("serial_number"),
    asset_tag: g("asset_tag"),
    color: g("color"),
    voltage: g("voltage"),
    power: g("power"),
    manufactured_at: g("manufactured_at"),
    location: g("location"),
    installation_date: g("installation_date"),
    next_preventive_date: g("next_preventive_date"),
    status: g("status") === "inactive" ? "inactive" : "active",
    notes: g("notes"),
  });
  if (!dados.client_id) redirect(`/equipamentos/${id}?erro=` + encodeURIComponent("Escolha o cliente."));
  const { error } = await supabase.from("equipment").update(dados).eq("id", id);
  if (error) {
    const msg = error.message.includes("equipment_asset_tag_uq") ? "Já existe outro equipamento ativo com esse patrimônio." : error.message;
    redirect(`/equipamentos/${id}?erro=` + encodeURIComponent(msg));
  }
  revalidatePath(`/equipamentos/${id}`);
  redirect(`/equipamentos/${id}?ok=1`);
}

async function salvarVinculo(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const vinculo = String(formData.get("vinculo")) === "contrato" ? "contrato" : "avulso";
  const contrato = String(formData.get("contract_id") || "") || null;
  const supabase = await createClient();
  // Avulso nunca fica ligado a contrato; contrato escolhido força o vínculo "contrato".
  const upd = vinculo === "avulso" ? { vinculo, contract_id: null } : { vinculo, contract_id: contrato };
  await supabase.from("equipment").update(upd).eq("id", id);
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

export default async function DetalheEquipamento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { id } = await params;
  const { erro, ok } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const editar = podeEditar(perfil?.role, perfil?.permissions, "equipamentos");

  const { data: e } = await supabase.from("equipment").select("*,clients(name)").eq("id", id).single();
  if (!e) notFound();
  const { data: emp } = await supabase.from("companies").select("slug").maybeSingle();
  const { data: todosClientes } = editar ? await supabase.from("clients").select("id, name").eq("active", true).order("name").limit(5000) : { data: [] as any[] };
  const { data: contratos } = await supabase
    .from("contracts")
    .select("id, code, contract_number, status, monthly_fee")
    .eq("client_id", (e as any).client_id)
    .order("created_at", { ascending: false });

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

      {erro && <div className="error" style={{ marginBottom: 12 }}>{erro}</div>}
      {ok && <div className="badge" style={{ marginBottom: 12 }}>Dados salvos.</div>}
      {editar && (
        <details className="card" style={{ marginBottom: 14 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>✏️ Editar dados do equipamento (cliente, modelo, série, patrimônio…)</summary>
          <form action={salvarDados} className="grid g3" style={{ marginTop: 12 }}>
            <input type="hidden" name="id" value={e.id} />
            <label className="field" style={{ gridColumn: "span 2" }}>Cliente
              <select name="client_id" defaultValue={e.client_id} required>
                {(todosClientes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                {!(todosClientes ?? []).some((c: any) => c.id === e.client_id) && <option value={e.client_id}>{(e as any).clients?.name ?? "Cliente atual"}</option>}
              </select>
            </label>
            <label className="field">Tipo
              <select name="equipment_type" defaultValue={e.equipment_type ?? "Impressora"}>
                {["Impressora", "Multifuncional", "Computador", "Notebook", "Scanner", "Outro"].map((t) => <option key={t}>{t}</option>)}
                {e.equipment_type && !["Impressora", "Multifuncional", "Computador", "Notebook", "Scanner", "Outro"].includes(e.equipment_type) && <option>{e.equipment_type}</option>}
              </select>
            </label>
            <label className="field">Marca<input name="brand" defaultValue={e.brand ?? ""} /></label>
            <label className="field">Modelo<input name="model" defaultValue={e.model ?? ""} /></label>
            <label className="field">Nº de série<input name="serial_number" defaultValue={e.serial_number ?? ""} /></label>
            <label className="field">Patrimônio<input name="asset_tag" defaultValue={e.asset_tag ?? ""} /></label>
            <label className="field">Cor<input name="color" defaultValue={(e as any).color ?? ""} /></label>
            <label className="field">Voltagem<input name="voltage" defaultValue={(e as any).voltage ?? ""} /></label>
            <label className="field">Potência<input name="power" defaultValue={(e as any).power ?? ""} /></label>
            <label className="field">Data de fabricação<input name="manufactured_at" type="date" defaultValue={(e as any).manufactured_at ?? ""} /></label>
            <label className="field">Localização<input name="location" defaultValue={e.location ?? ""} /></label>
            <label className="field">Data de instalação<input name="installation_date" type="date" defaultValue={e.installation_date ?? ""} /></label>
            <label className="field">Próxima preventiva<input name="next_preventive_date" type="date" defaultValue={e.next_preventive_date ?? ""} /></label>
            <label className="field">Situação
              <select name="status" defaultValue={e.status === "inactive" ? "inactive" : "active"}>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </label>
            <label className="field" style={{ gridColumn: "1/-1" }}>Observações<textarea name="notes" rows={2} defaultValue={e.notes ?? ""} /></label>
            <div style={{ gridColumn: "1/-1" }}><button className="btn primary" type="submit">Salvar dados</button></div>
          </form>
        </details>
      )}

      <form action={salvarVinculo} className="card" style={{ marginBottom: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input type="hidden" name="id" value={e.id} />
        <b>Vínculo:</b>
        <select name="vinculo" defaultValue={(e as any).vinculo ?? "avulso"} disabled={!editar}>
          <option value="contrato">Contrato</option>
          <option value="avulso">Avulso (cliente que presta serviço)</option>
        </select>
        <select name="contract_id" defaultValue={e.contract_id ?? ""} disabled={!editar}>
          <option value="">Sem contrato específico</option>
          {(contratos ?? []).map((c: any) => (
            <option key={c.id} value={c.id}>{c.code ?? `#${c.contract_number}`} · {c.status}</option>
          ))}
        </select>
        {editar && <button className="btn secondary" type="submit">Salvar</button>}
        <span className="muted">
          {(contratos ?? []).length ? "Contratos deste cliente." : "Este cliente não tem contrato cadastrado."} Escolher um contrato marca como “Contrato”; “Avulso” remove a ligação. O histórico de manutenção fica sempre guardado.
        </span>
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
