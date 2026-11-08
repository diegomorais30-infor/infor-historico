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
        <QR code={e.code} token={e.qr_token} tag={e.asset_tag} slug={(emp as any)?.slug ?? null} />
      </div>

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
