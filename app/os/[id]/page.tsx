import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { fmtData, moeda } from "@/lib/format";
import { COR_STATUS_OS, FLUXO_OS, PRIORIDADE_OS, progressoOS, RESPONSAVEL_ETAPA, SITUACOES_OS, STATUS_OS } from "@/lib/os";
import { podeEditar, podeVer } from "@/lib/permissoes";

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
      warranty: formData.get("warranty") === "on",
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
  const service_id = String(formData.get("service_id") || "") || null;
  if (!description && !part_id && !service_id) redirect(`/os/${order_id}?erro=` + encodeURIComponent("Descreva o serviço ou escolha a peça."));
  let desc = description;
  if (kind === "servico" && service_id && !desc) {
    const { data: sv } = await supabase.from("catalog_services").select("name").eq("id", service_id).single();
    desc = (sv as any)?.name ?? "Serviço";
  }
  if (part_id && !desc) {
    const { data: p } = await supabase.from("parts").select("name").eq("id", part_id).single();
    desc = (p as any)?.name ?? "Peça";
  }
  const { error } = await supabase
    .from("service_order_items")
    .insert({ order_id, kind, description: desc, quantity, part_id: kind === "peca" ? part_id : null, service_id: kind === "servico" ? service_id : null });
  if (error) redirect(`/os/${order_id}?erro=` + encodeURIComponent(error.message));
  revalidatePath(`/os/${order_id}`);
  redirect(`/os/${order_id}`);
}

async function salvarFinanceiro(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  const num = (k: string) => Number(String(formData.get(k) || "0").replace(",", ".")) || 0;
  const { error } = await supabase.from("order_finance").upsert(
    {
      order_id,
      discount: num("discount"),
      advance: num("advance"),
      payment_method: String(formData.get("payment_method") || "").trim() || null,
      due_date: String(formData.get("due_date") || "") || null,
    },
    { onConflict: "order_id" }
  );
  if (error) redirect(`/os/${order_id}?erro=` + encodeURIComponent(error.message));
  // preços unitários editados
  for (const [k, v] of formData.entries()) {
    if (!k.startsWith("preco_")) continue;
    const item_id = k.slice(6);
    const unit_price = Number(String(v || "0").replace(",", ".")) || 0;
    await supabase.from("item_prices").upsert({ item_id, unit_price }, { onConflict: "item_id" });
  }
  revalidatePath(`/os/${order_id}`);
  redirect(`/os/${order_id}?ok=1`);
}

async function faturar(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  const { data: os } = await supabase.from("service_orders").select("number, client_id, status, clients(name)").eq("id", order_id).single();
  if (!os) redirect(`/os/${order_id}?erro=` + encodeURIComponent("OS não encontrada."));
  const o: any = os;
  if (!["concluido", "faturado"].includes(o.status))
    redirect(`/os/${order_id}?erro=` + encodeURIComponent("Conclua a OS antes de faturar."));
  const [{ data: itens }, { data: precos }, { data: fin }] = await Promise.all([
    supabase.from("service_order_items").select("id, quantity").eq("order_id", order_id),
    supabase.from("item_prices").select("item_id, unit_price"),
    supabase.from("order_finance").select("*").eq("order_id", order_id).maybeSingle(),
  ]);
  const mapa: Record<string, number> = {};
  for (const r of precos ?? []) mapa[(r as any).item_id] = Number((r as any).unit_price);
  const subtotal = (itens ?? []).reduce((t: number, i: any) => t + Number(i.quantity) * (mapa[i.id] ?? 0), 0);
  const f: any = fin ?? {};
  const total = Math.max(subtotal - Number(f.discount ?? 0), 0);
  const adiant = Math.min(Number(f.advance ?? 0), total);
  const resto = total - adiant;
  if (total <= 0) redirect(`/os/${order_id}?erro=` + encodeURIComponent("Lance os valores da OS antes de faturar."));
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const base = {
    kind: "receita",
    category: "Ordem de Serviço",
    party: o.clients?.name ?? null,
    client_id: o.client_id,
    order_id,
    payment_method: f.payment_method ?? null,
    competence: hoje,
  };
  if (resto > 0) {
    const { error } = await supabase.from("finance_entries").upsert(
      { ...base, origin: "os_fatura", description: `OS #${o.number} · fatura`, amount: resto, due_date: f.due_date ?? hoje },
      { onConflict: "order_id,origin", ignoreDuplicates: true }
    );
    if (error) redirect(`/os/${order_id}?erro=` + encodeURIComponent(error.message));
  }
  if (adiant > 0) {
    await supabase.from("finance_entries").upsert(
      { ...base, origin: "os_adiantamento", description: `OS #${o.number} · adiantamento`, amount: adiant, due_date: hoje, paid_at: hoje },
      { onConflict: "order_id,origin", ignoreDuplicates: true }
    );
  }
  await supabase.from("service_orders").update({ status: "faturado" }).eq("id", order_id);
  revalidatePath(`/os/${order_id}`);
  redirect(`/os/${order_id}?ok=1`);
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

  const perms = (perfil as any)?.permissions;
  const verFin = podeVer(perfil?.role, perms, "financeiro");
  const editFin = podeEditar(perfil?.role, perms, "financeiro");
  const [{ data: itens }, { data: equipe }, { data: pecas }, { data: servicos }] = await Promise.all([
    supabase.from("service_order_items").select("id, kind, description, quantity").eq("order_id", id).order("created_at"),
    supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name"),
    supabase.from("parts").select("id, name, code").eq("active", true).order("name"),
    supabase.from("catalog_services").select("id, name").eq("active", true).order("name"),
  ]);
  const precoItem: Record<string, number> = {};
  let fin: any = { discount: 0, advance: 0, payment_method: "", due_date: "" };
  if (verFin) {
    const { data: ip } = await supabase.from("item_prices").select("item_id, unit_price");
    for (const r of ip ?? []) precoItem[(r as any).item_id] = Number((r as any).unit_price);
    const { data: of } = await supabase.from("order_finance").select("*").eq("order_id", id).maybeSingle();
    if (of) fin = of;
  }
  const subtotal = (itens ?? []).reduce((t: number, i: any) => t + Number(i.quantity) * (precoItem[i.id] ?? 0), 0);
  const total = Math.max(subtotal - Number(fin.discount ?? 0), 0);
  const aPagar = Math.max(total - Number(fin.advance ?? 0), 0);

  const atendente = (equipe ?? []).find((p: any) => p.id === o.created_by)?.full_name;
  const progresso = progressoOS(o.status);
  const idxAtual = FLUXO_OS.indexOf(o.status);

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

      {o.status !== "cancelado" && (
        <section className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {FLUXO_OS.map((e, i) => (
              <div
                key={e}
                title={RESPONSAVEL_ETAPA[e]}
                style={{
                  flex: "1 1 80px",
                  textAlign: "center",
                  padding: "6px 4px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  background: i <= idxAtual ? COR_STATUS_OS[o.status] : "transparent",
                  border: "1px solid var(--line, #3a4a5c)",
                  color: i <= idxAtual ? "#fff" : "inherit",
                  opacity: i <= idxAtual ? 1 : 0.6,
                }}
              >
                {STATUS_OS[e]}
                <div style={{ fontSize: 10, fontWeight: 400 }}>{RESPONSAVEL_ETAPA[e]}</div>
              </div>
            ))}
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            Progresso: {progresso}%{atendente && <> · Atendente: {atendente}</>}
            {o.warranty && <> · <b>Em garantia</b></>}
          </div>
        </section>
      )}

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
        <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input name="warranty" type="checkbox" defaultChecked={o.warranty} disabled={!editar} style={{ width: "auto" }} />
          Atendimento em garantia
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
              {verFin && <th>Valor unit.</th>}
              {verFin && <th>Subtotal</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(itens ?? []).map((i: any) => (
              <tr key={i.id}>
                <td>{i.kind === "peca" ? "Peça" : "Serviço"}</td>
                <td>{i.description}</td>
                <td>{Number(i.quantity)}</td>
                {verFin && (
                  <td>
                    {editFin ? (
                      <input form="fin" name={`preco_${i.id}`} inputMode="decimal" defaultValue={precoItem[i.id] ?? 0} style={{ width: 90 }} aria-label="Valor unitário" />
                    ) : (
                      moeda(precoItem[i.id])
                    )}
                  </td>
                )}
                {verFin && <td>{moeda(Number(i.quantity) * (precoItem[i.id] ?? 0))}</td>}
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
                <td colSpan={6} className="muted">
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
              Serviço do catálogo (se for serviço)
              <select name="service_id" defaultValue="">
                <option value="">—</option>
                {(servicos ?? []).map((sv: any) => (
                  <option key={sv.id} value={sv.id}>
                    {sv.name}
                  </option>
                ))}
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
      {verFin && (
        <form id="fin" action={salvarFinanceiro} className="card grid g4" style={{ marginTop: 14 }}>
          <input type="hidden" name="order_id" value={o.id} />
          <h2 style={{ gridColumn: "1/-1", margin: 0 }}>Valores</h2>
          <div>
            <div className="muted">Subtotal</div>
            <b>{moeda(subtotal)}</b>
          </div>
          <label className="field">
            Desconto (R$)
            <input name="discount" inputMode="decimal" defaultValue={Number(fin.discount ?? 0)} disabled={!editFin} />
          </label>
          <label className="field">
            Adiantamento (R$)
            <input name="advance" inputMode="decimal" defaultValue={Number(fin.advance ?? 0)} disabled={!editFin} />
          </label>
          <div>
            <div className="muted">Total / a pagar</div>
            <b>{moeda(total)}</b> / <b>{moeda(aPagar)}</b>
          </div>
          <label className="field">
            Forma de pagamento
            <input name="payment_method" list="formas" defaultValue={fin.payment_method ?? ""} disabled={!editFin} />
            <datalist id="formas">
              {["Pix", "Dinheiro", "Débito", "Crédito", "Boleto", "Transferência"].map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </label>
          <label className="field">
            Vencimento
            <input name="due_date" type="date" defaultValue={fin.due_date ?? ""} disabled={!editFin} />
          </label>
          {editFin && (
            <div style={{ gridColumn: "1/-1" }}>
              <button className="btn primary">Salvar valores</button>
            </div>
          )}
        </form>
      )}
      {editFin && ["concluido"].includes(o.status) && (
        <form action={faturar} className="card" style={{ marginTop: 14 }}>
          <input type="hidden" name="order_id" value={o.id} />
          <b>Faturar esta OS</b>
          <p className="muted" style={{ margin: "6px 0 10px" }}>
            Gera a receita no financeiro (e o adiantamento como já recebido) e muda o status para Faturado. Salve os valores antes.
          </p>
          <button className="btn primary">Faturar OS</button>
        </form>
      )}
      {verFin && o.status === "faturado" && (
        <p className="muted" style={{ marginTop: 14 }}>
          OS faturada — veja a receita em <Link href="/financeiro" style={{ color: "var(--link)" }}>Financeiro</Link>.
        </p>
      )}
    </main>
  );
}
