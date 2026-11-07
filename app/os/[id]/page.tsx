import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { fmtData } from "@/lib/format";
import { COR_STATUS_OS, PRIORIDADE_OS, SITUACOES_OS, STATUS_OS } from "@/lib/os";
import { podeEditar } from "@/lib/permissoes";

async function salvar(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const priority = String(formData.get("priority"));
  const texto = (k: string) => String(formData.get(k) || "").trim() || null;
  const { error } = await supabase
    .from("service_orders")
    .update({
      status,
      priority,
      situacao: texto("situacao"),
      deadline: texto("deadline"),
      technician_id: texto("technician_id"),
      report: texto("report"),
      defect: texto("defect"),
      external_invoice_number: texto("external_invoice_number"),
    })
    .eq("id", id);
  if (error) redirect(`/os/${id}?erro=` + encodeURIComponent(error.message));
  revalidatePath(`/os/${id}`);
  redirect(`/os/${id}?ok=1`);
}

async function adicionarItem(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  const description = String(formData.get("description") || "").trim();
  const kind = String(formData.get("kind") || "servico");
  const quantity = Number(String(formData.get("quantity") || "1").replace(",", ".")) || 1;
  const part_id = String(formData.get("part_id") || "") || null;
  if (!description && !part_id) redirect(`/os/${order_id}?erro=` + encodeURIComponent("Descreva o serviço ou escolha a peça."));
  let desc = description;
  if (part_id && !desc) {
    const { data: p } = await supabase.from("parts").select("name").eq("id", part_id).single();
    desc = (p as any)?.name ?? "Peça";
  }
  const { error } = await supabase
    .from("service_order_items")
    .insert({ order_id, kind, description: desc, quantity, part_id: kind === "peca" ? part_id : null });
  if (error) redirect(`/os/${order_id}?erro=` + encodeURIComponent(error.message));
  revalidatePath(`/os/${order_id}`);
  redirect(`/os/${order_id}`);
}

async function removerItem(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  const { error } = await supabase.from("service_order_items").delete().eq("id", String(formData.get("id")));
  if (error) redirect(`/os/${order_id}?erro=` + encodeURIComponent(error.message));
  revalidatePath(`/os/${order_id}`);
  redirect(`/os/${order_id}`);
}

export default async function DetalheOS({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { id } = await params;
  const { erro, ok } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const editar = podeEditar(perfil?.role, (perfil as any)?.permissions, "os");

  const { data: os } = await supabase
    .from("service_orders")
    .select("*, clients(name, phone), equipment(id, code, brand, model, serial_number), service_requests(protocol)")
    .eq("id", id)
    .single();
  if (!os) notFound();
  const o: any = os;

  const [{ data: itens }, { data: equipe }, { data: pecas }] = await Promise.all([
    supabase.from("service_order_items").select("id, kind, description, quantity").eq("order_id", id).order("created_at"),
    supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name"),
    supabase.from("parts").select("id, name, code").eq("active", true).order("name"),
  ]);

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="title">OS #{o.number}</h1>
          <div className="muted">
            Entrada em {fmtData(o.entry_at)} ·{" "}
            <span style={{ color: COR_STATUS_OS[o.status], fontWeight: 700 }}>{STATUS_OS[o.status]}</span>
            {o.service_requests?.protocol && <> · chamado {o.service_requests.protocol}</>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn secondary" href={`/os/${o.id}/imprimir`}>
            Imprimir
          </Link>
          <Link className="btn secondary" href="/os">
            Voltar
          </Link>
        </div>
      </div>

      {erro && <div className="error" style={{ margin: "10px 0" }}>{erro}</div>}
      {ok && <div className="card" style={{ margin: "10px 0" }}>Salvo.</div>}

      <section className="card" style={{ marginBottom: 14 }}>
        <div>
          <b>{o.clients?.name}</b> {o.clients?.phone && <span className="muted">· {o.clients.phone}</span>}
        </div>
        <div className="muted">
          {o.equipment ? (
            <>
              <Link href={`/equipamentos/${o.equipment.id}`} style={{ color: "var(--link)" }}>
                {o.equipment.code}
              </Link>{" "}
              · {o.equipment.brand} {o.equipment.model} · série {o.equipment.serial_number ?? "—"}
            </>
          ) : (
            "Sem equipamento vinculado"
          )}
        </div>
      </section>

      <form action={salvar} className="card grid g2" style={{ marginBottom: 14 }}>
        <input type="hidden" name="id" value={o.id} />
        <label className="field">
          Status
          <select name="status" defaultValue={o.status} disabled={!editar}>
            {Object.entries(STATUS_OS).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Situação
          <input name="situacao" list="situacoes" defaultValue={o.situacao ?? ""} disabled={!editar} />
          <datalist id="situacoes">
            {SITUACOES_OS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="field">
          Prioridade
          <select name="priority" defaultValue={o.priority} disabled={!editar}>
            {Object.entries(PRIORIDADE_OS).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Prazo
          <input name="deadline" type="date" defaultValue={o.deadline ?? ""} disabled={!editar} />
        </label>
        <label className="field">
          Técnico
          <select name="technician_id" defaultValue={o.technician_id ?? ""} disabled={!editar}>
            <option value="">Ninguém</option>
            {(equipe ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.full_name || "Sem nome"}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Nº da nota fiscal (emitida fora do sistema)
          <input name="external_invoice_number" defaultValue={o.external_invoice_number ?? ""} disabled={!editar} />
        </label>
        <label className="field" style={{ gridColumn: "1/-1" }}>
          Defeito relatado
          <textarea name="defect" rows={2} defaultValue={o.defect ?? ""} disabled={!editar} />
        </label>
        <label className="field" style={{ gridColumn: "1/-1" }}>
          Laudo / serviço realizado
          <textarea name="report" rows={4} defaultValue={o.report ?? ""} disabled={!editar} />
        </label>
        {editar && (
          <div style={{ gridColumn: "1/-1" }}>
            <button className="btn primary">Salvar</button>
          </div>
        )}
      </form>

      <section className="card">
        <h2>Serviços e peças</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Qtd</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(itens ?? []).map((i: any) => (
              <tr key={i.id}>
                <td>{i.kind === "peca" ? "Peça" : "Serviço"}</td>
                <td>{i.description}</td>
                <td>{Number(i.quantity)}</td>
                <td>
                  {editar && (
                    <form action={removerItem}>
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="order_id" value={o.id} />
                      <button className="btn secondary">Remover</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!(itens ?? []).length && (
              <tr>
                <td colSpan={4} className="muted">
                  Nada lançado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {editar && (
          <form action={adicionarItem} className="grid g4" style={{ marginTop: 12 }}>
            <input type="hidden" name="order_id" value={o.id} />
            <label className="field">
              Tipo
              <select name="kind" defaultValue="servico">
                <option value="servico">Serviço</option>
                <option value="peca">Peça</option>
              </select>
            </label>
            <label className="field">
              Peça do estoque (se for peça)
              <select name="part_id" defaultValue="">
                <option value="">—</option>
                {(pecas ?? []).map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.code ? ` (${p.code})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Descrição
              <input name="description" />
            </label>
            <label className="field">
              Qtd
              <input name="quantity" defaultValue="1" inputMode="decimal" />
            </label>
            <div style={{ gridColumn: "1/-1" }}>
              <button className="btn secondary">Adicionar</button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
