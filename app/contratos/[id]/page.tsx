import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { STATUS_CONTRATO, STATUS_FATURA, fmtData, hojeBR, mesRotulo, moeda } from "@/lib/format";

function voltar(id: string, tipo: "erro" | "aviso", texto: string): never {
  redirect(`/contratos/${id}?${tipo}=${encodeURIComponent(texto)}`);
}

async function vincular(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const contrato = String(formData.get("contrato"));
  const equipamento = String(formData.get("equipamento") || "");
  if (!equipamento) voltar(contrato, "erro", "Escolha uma impressora.");
  const { error } = await supabase.from("equipment").update({ contract_id: contrato }).eq("id", equipamento);
  if (error) voltar(contrato, "erro", error.message);
  revalidatePath(`/contratos/${contrato}`);
  redirect(`/contratos/${contrato}`);
}

async function desvincular(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const contrato = String(formData.get("contrato"));
  const { error } = await supabase
    .from("equipment")
    .update({ contract_id: null })
    .eq("id", String(formData.get("equipamento")));
  if (error) voltar(contrato, "erro", error.message);
  revalidatePath(`/contratos/${contrato}`);
  redirect(`/contratos/${contrato}`);
}

async function fecharMes(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const contrato = String(formData.get("contrato"));
  const mes = String(formData.get("mes") || "");
  if (!/^\d{4}-\d{2}$/.test(mes)) voltar(contrato, "erro", "Escolha o mês.");

  const { data, error } = await supabase.rpc("fechar_mes", { p_contract: contrato, p_month: `${mes}-01` });
  if (error) voltar(contrato, "erro", error.message);

  const faltando: string[] = data?.missing ?? [];
  revalidatePath(`/contratos/${contrato}`);
  if (faltando.length) {
    voltar(
      contrato,
      "aviso",
      `Fatura de ${mesRotulo(mes)} gerada, mas faltam leituras de: ${faltando.join(", ")}. Lance as leituras e feche o mês de novo.`
    );
  }
  voltar(contrato, "aviso", `Fatura de ${mesRotulo(mes)} gerada: ${moeda(data?.total)}.`);
}

async function marcarPaga(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const contrato = String(formData.get("contrato"));
  const { error } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", String(formData.get("fatura")));
  if (error) voltar(contrato, "erro", error.message);
  revalidatePath(`/contratos/${contrato}`);
  redirect(`/contratos/${contrato}`);
}

async function mudarSituacao(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const contrato = String(formData.get("contrato"));
  const status = String(formData.get("status"));
  if (!["active", "suspended", "ended"].includes(status)) voltar(contrato, "erro", "Situação inválida.");
  const { error } = await supabase.from("contracts").update({ status }).eq("id", contrato);
  if (error) voltar(contrato, "erro", error.message);
  revalidatePath(`/contratos/${contrato}`);
  redirect(`/contratos/${contrato}`);
}

export default async function DetalheContrato({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; aviso?: string }>;
}) {
  const { id } = await params;
  const { erro, aviso } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const gerente = perfil?.role === "admin" || perfil?.role === "manager";

  const { data: c } = await supabase.from("contracts").select("*, clients(name)").eq("id", id).single();
  if (!c) notFound();

  const [{ data: instaladas }, { data: livres }, { data: faturas }] = await Promise.all([
    supabase
      .from("equipment")
      .select("id, code, brand, model, serial_number, location")
      .eq("contract_id", id)
      .order("code"),
    supabase
      .from("equipment")
      .select("id, code, brand, model")
      .is("contract_id", null)
      .eq("client_id", c.client_id)
      .order("code"),
    supabase.from("invoices").select("*").eq("contract_id", id).order("reference_month", { ascending: false }),
  ]);

  const mesAnterior = (() => {
    const [a, m] = hojeBR().slice(0, 7).split("-").map(Number);
    return new Date(Date.UTC(a, m - 2, 1)).toISOString().slice(0, 7);
  })();

  return (
    <main className="wrap">
      <Link href="/contratos" className="muted">
        ← Contratos
      </Link>
      <div className="headrow" style={{ margin: "14px 0 18px" }}>
        <div>
          <div className="muted">{c.code}</div>
          <h1 className="title">{(c as any).clients?.name ?? "Cliente"}</h1>
          <span className={c.status === "active" ? "badge" : "badge warn"}>{STATUS_CONTRATO[c.status]}</span>
        </div>
        {gerente && (
          <form action={mudarSituacao} className="inline">
            <input type="hidden" name="contrato" value={id} />
            <select name="status" defaultValue={c.status}>
              {Object.entries(STATUS_CONTRATO).map(([valor, nome]) => (
                <option key={valor} value={valor}>
                  {nome}
                </option>
              ))}
            </select>
            <button className="btn secondary">Alterar situação</button>
          </form>
        )}
      </div>

      {erro && <div className="error" style={{ marginBottom: 14 }}>{erro}</div>}
      {aviso && <div className="ok" style={{ marginBottom: 14 }}>{aviso}</div>}

      <div className="grid g4">
        <div className="card">
          <div className="muted">Mensalidade</div>
          <b>{moeda(c.monthly_fee)}</b>
        </div>
        <div className="card">
          <div className="muted">Franquia P&amp;B / Cor</div>
          <b>
            {c.pages_included_bw} / {c.pages_included_color}
          </b>
        </div>
        <div className="card">
          <div className="muted">Excedente P&amp;B / Cor</div>
          <b>
            {moeda(c.extra_page_price_bw)} / {moeda(c.extra_page_price_color)}
          </b>
        </div>
        <div className="card">
          <div className="muted">Vigência</div>
          <b>
            {fmtData(c.start_date)} a {fmtData(c.end_date)}
          </b>
          <div className="muted" style={{ fontSize: 13 }}>
            Reajuste: {fmtData(c.next_adjustment_date)} · Cobrança dia {c.billing_day}
          </div>
        </div>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Impressoras do contrato</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Equipamento</th>
              <th>Nº série</th>
              <th>Local</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(instaladas ?? []).map((e: any) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/equipamentos/${e.id}`} style={{ color: "var(--blue)", fontWeight: 800 }}>
                    {e.code}
                  </Link>
                </td>
                <td>
                  {e.brand} {e.model}
                </td>
                <td>{e.serial_number ?? "—"}</td>
                <td>{e.location ?? "—"}</td>
                <td>
                  {gerente && (
                    <form action={desvincular}>
                      <input type="hidden" name="contrato" value={id} />
                      <input type="hidden" name="equipamento" value={e.id} />
                      <button className="btn danger">Remover</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!(instaladas ?? []).length && (
              <tr>
                <td colSpan={5} className="muted">
                  Nenhuma impressora vinculada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {gerente && (
          <form action={vincular} className="inline" style={{ marginTop: 14 }}>
            <input type="hidden" name="contrato" value={id} />
            <select name="equipamento" defaultValue="">
              <option value="">Adicionar impressora deste cliente...</option>
              {(livres ?? []).map((e: any) => (
                <option key={e.id} value={e.id}>
                  {e.code} — {e.brand} {e.model}
                </option>
              ))}
            </select>
            <button className="btn secondary">Vincular</button>
          </form>
        )}
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="headrow">
          <h2 style={{ margin: 0 }}>Faturas</h2>
          {gerente && (
            <form action={fecharMes} className="inline">
              <input type="hidden" name="contrato" value={id} />
              <input name="mes" type="month" defaultValue={mesAnterior} required />
              <button className="btn primary">Fechar mês</button>
            </form>
          )}
        </div>
        <p className="muted" style={{ margin: "6px 0 12px" }}>
          O fechamento usa as leituras do mês na tela Leituras. Pode ser refeito enquanto a fatura não estiver paga.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Mês</th>
              <th>Páginas P&amp;B / Cor</th>
              <th>Excedente</th>
              <th>Total</th>
              <th>Vencimento</th>
              <th>Situação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(faturas ?? []).map((f: any) => (
              <tr key={f.id}>
                <td>{mesRotulo(f.reference_month)}</td>
                <td>
                  {f.pages_bw} / {f.pages_color}
                </td>
                <td>{moeda(f.amount_extra)}</td>
                <td>
                  <b>{moeda(f.total)}</b>
                </td>
                <td>{fmtData(f.due_date)}</td>
                <td>
                  <span className={f.status === "paid" ? "badge" : "badge warn"}>{STATUS_FATURA[f.status]}</span>
                </td>
                <td>
                  {gerente && f.status === "open" && (
                    <form action={marcarPaga}>
                      <input type="hidden" name="contrato" value={id} />
                      <input type="hidden" name="fatura" value={f.id} />
                      <button className="btn secondary">Marcar paga</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!(faturas ?? []).length && (
              <tr>
                <td colSpan={7} className="muted">
                  Nenhuma fatura gerada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
