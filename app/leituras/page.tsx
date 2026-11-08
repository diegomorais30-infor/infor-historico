import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { hojeBR, mesRotulo, somaMes, moeda } from "@/lib/format";

function voltar(mes: string, tipo: "erro" | "aviso", texto: string): never {
  redirect(`/leituras?mes=${mes}&${tipo}=${encodeURIComponent(texto)}`);
}

async function salvarLeitura(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const mes = String(formData.get("mes"));
  const equipamento = String(formData.get("equipamento"));
  if (!/^\d{4}-\d{2}$/.test(mes)) redirect("/leituras");

  const pb = Number(formData.get("counter_bw"));
  const cor = Number(formData.get("counter_color") || 0);
  if (!Number.isFinite(pb) || pb < 0 || formData.get("counter_bw") === "") {
    voltar(mes, "erro", "Informe o contador P&B.");
  }
  if (!Number.isFinite(cor) || cor < 0) voltar(mes, "erro", "Contador colorido inválido.");

  // Não aceita contador menor que o da leitura anterior (erro de digitação)
  const { data: anterior } = await supabase
    .from("meter_readings")
    .select("counter_bw, counter_color, reference_month")
    .eq("equipment_id", equipamento)
    .lt("reference_month", `${mes}-01`)
    .order("reference_month", { ascending: false })
    .limit(1);
  const ant = anterior?.[0];
  if (ant && (pb < Number(ant.counter_bw) || cor < Number(ant.counter_color))) {
    voltar(mes, "erro", `A leitura é menor que a de ${mesRotulo(ant.reference_month)} (${ant.counter_bw} / ${ant.counter_color}). Confira os números.`);
  }

  const { error } = await supabase.from("meter_readings").upsert(
    {
      equipment_id: equipamento,
      reference_month: `${mes}-01`,
      reading_date: hojeBR(),
      counter_bw: Math.round(pb),
      counter_color: Math.round(cor),
      source: "manual",
      created_by: user.id,
    },
    { onConflict: "equipment_id,reference_month" }
  );
  if (error) voltar(mes, "erro", error.message);

  revalidatePath("/leituras");
  redirect(`/leituras?mes=${mes}`);
}

async function salvarValores(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const mes = String(formData.get("mes"));
  const contrato = String(formData.get("contrato"));
  if (!/^\d{4}-\d{2}$/.test(mes) || !contrato) redirect("/leituras");
  const num = (k: string) => {
    const b = String(formData.get(k) ?? "").trim().replace(",", ".");
    if (b === "") return null;
    const n = Number(b);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  };
  const campos = {
    monthly_fee: num("monthly_fee"),
    pages_included_bw: num("pages_included_bw"),
    pages_included_color: num("pages_included_color"),
    extra_page_price_bw: num("extra_page_price_bw"),
    extra_page_price_color: num("extra_page_price_color"),
  };
  if (Object.values(campos).some((v) => Number.isNaN(v))) voltar(mes, "erro", "Valor inválido nos valores específicos.");
  const nota = String(formData.get("note") ?? "").trim() || null;
  if (Object.values(campos).every((v) => v === null) && !nota) {
    await supabase.from("contract_month_terms").delete().eq("contract_id", contrato).eq("reference_month", `${mes}-01`);
  } else {
    const { error } = await supabase.from("contract_month_terms").upsert(
      { contract_id: contrato, reference_month: `${mes}-01`, ...campos, pages_included_bw: campos.pages_included_bw === null ? null : Math.round(campos.pages_included_bw as number), pages_included_color: campos.pages_included_color === null ? null : Math.round(campos.pages_included_color as number), note: nota },
      { onConflict: "contract_id,reference_month" }
    );
    if (error) voltar(mes, "erro", error.message);
  }
  revalidatePath("/leituras");
  redirect(`/leituras?mes=${mes}&aviso=${encodeURIComponent("Valores do mês salvos. Feche o mês no contrato para refazer a fatura.")}`);
}

export default async function Leituras({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; erro?: string; aviso?: string; ver?: string; cliente?: string; escopo?: string; q?: string }>;
}) {
  const { mes: mesParam, erro, aviso, ver: verParam, cliente: clienteSel, escopo: escopoParam, q } = await searchParams;
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : hojeBR().slice(0, 7);
  const ver = verParam === "contrato" ? "contrato" : "cliente";
  const escopo = escopoParam === "todas" ? "todas" : "locacao";
  const { supabase } = await getContexto();

  const { data: equipamentos } = await supabase
    .from("equipment")
    .select("id, code, equipment_number, asset_tag, brand, model, serial_number, contract_id, client_id, clients(name), contracts(code)")
    .eq("status", "active")
    .limit(2000);
  let lista: any[] = equipamentos ?? [];
  if (escopo === "locacao") lista = lista.filter((e) => e.contract_id || e.asset_tag);
  const clientesLista = Array.from(new Map(lista.map((e) => [e.client_id, e.clients?.name ?? "Sem cliente"])).entries()).sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  if (clienteSel) lista = lista.filter((e) => e.client_id === clienteSel);
  if (q) {
    const t = q.toLowerCase();
    lista = lista.filter((e) => `${e.asset_tag ?? ""} ${e.brand ?? ""} ${e.model ?? ""} ${e.serial_number ?? ""} ${e.clients?.name ?? ""}`.toLowerCase().includes(t));
  }

  const { data: doMes } = await supabase.from("meter_readings").select("*").eq("reference_month", `${mes}-01`);
  const leituraDoMes = new Map<string, any>((doMes ?? []).map((l: any) => [l.equipment_id, l]));

  const { data: antigas } = await supabase
    .from("meter_readings")
    .select("equipment_id, counter_bw, counter_color, reference_month")
    .lt("reference_month", `${mes}-01`)
    .order("reference_month", { ascending: false });
  const anterior = new Map<string, any>();
  (antigas ?? []).forEach((l: any) => {
    if (!anterior.has(l.equipment_id)) anterior.set(l.equipment_id, l);
  });

  const { data: contratosDados } = await supabase.from("contracts").select("id, code, monthly_fee, pages_included_bw, pages_included_color, extra_page_price_bw, extra_page_price_color");
  const contratoPorId = new Map<string, any>((contratosDados ?? []).map((c: any) => [c.id, c]));
  const { data: termosMes } = await supabase.from("contract_month_terms").select("*").eq("reference_month", `${mes}-01`);
  const termoPorContrato = new Map<string, any>((termosMes ?? []).map((t: any) => [t.contract_id, t]));

  const lidas = lista.filter((e) => leituraDoMes.has(e.id)).length;

  // Agrupa por cliente ou por contrato
  const grupos = new Map<string, { titulo: string; sub: string; itens: any[] }>();
  for (const e of lista) {
    const chave = ver === "contrato" ? (e.contract_id ?? `sem-${e.client_id}`) : e.client_id;
    const titulo =
      ver === "contrato"
        ? `${e.contracts?.code ?? "Sem contrato"} — ${e.clients?.name ?? "Sem cliente"}`
        : e.clients?.name ?? "Sem cliente";
    if (!grupos.has(chave)) grupos.set(chave, { titulo, sub: "", itens: [] });
    grupos.get(chave)!.itens.push(e);
  }
  const ordenados = Array.from(grupos.values()).sort((a, b) => a.titulo.localeCompare(b.titulo));
  for (const g of ordenados) g.itens.sort((a, b) => String(a.asset_tag ?? "").localeCompare(String(b.asset_tag ?? ""), undefined, { numeric: true }));

  const base = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ mes, ver, escopo, ...(clienteSel ? { cliente: clienteSel } : {}), ...(q ? { q } : {}), ...extra });
    return `/leituras?${p.toString()}`;
  };

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="title">Leituras dos contadores</h1>
          <p className="muted">
            {lidas} de {lista.length} impressoras lidas em {mesRotulo(mes)} · {ordenados.length} {ver === "contrato" ? "contrato(s)" : "cliente(s)"}.
          </p>
        </div>
        <div className="inline" style={{ display: "flex", gap: 8 }}>
          <Link className="btn secondary" href={base({ mes: somaMes(mes, -1) })}>← {mesRotulo(somaMes(mes, -1))}</Link>
          <Link className="btn secondary" href={base({ mes: somaMes(mes, 1) })}>{mesRotulo(somaMes(mes, 1))} →</Link>
        </div>
      </div>

      {erro && <div className="error" style={{ marginBottom: 14 }}>{erro}</div>}
      {aviso && <div className="card" style={{ marginBottom: 14 }}>{aviso}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <Link className={ver === "cliente" ? "btn primary" : "btn secondary"} href={base({ ver: "cliente" })}>Por cliente</Link>
        <Link className={ver === "contrato" ? "btn primary" : "btn secondary"} href={base({ ver: "contrato" })}>Por contrato</Link>
        <Link className={escopo === "locacao" ? "btn primary" : "btn secondary"} href={base({ escopo: "locacao" })}>Só locação</Link>
        <Link className={escopo === "todas" ? "btn primary" : "btn secondary"} href={base({ escopo: "todas" })}>Todas as impressoras</Link>
      </div>

      <form className="card" style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input type="hidden" name="mes" value={mes} />
        <input type="hidden" name="ver" value={ver} />
        <input type="hidden" name="escopo" value={escopo} />
        <input name="q" defaultValue={q} placeholder="Buscar patrimônio, modelo, série ou cliente" style={{ flex: 1, minWidth: 220 }} />
        <select name="cliente" defaultValue={clienteSel ?? ""}>
          <option value="">Todos os clientes</option>
          {clientesLista.map(([id, nome]) => (
            <option key={String(id)} value={String(id)}>{String(nome)}</option>
          ))}
        </select>
        <button className="btn secondary">Filtrar</button>
      </form>

      {ordenados.map((g) => {
        const feitas = g.itens.filter((e) => leituraDoMes.has(e.id)).length;
        return (
          <section className="card" key={g.titulo} style={{ marginBottom: 14, overflowX: "auto" }}>
            <div className="headrow" style={{ marginBottom: 8 }}>
              <b>{g.titulo}</b>
              <span className={feitas === g.itens.length ? "badge" : "badge warn"}>{feitas}/{g.itens.length} lidas</span>
            </div>
            {Array.from(new Set(g.itens.map((e: any) => e.contract_id).filter(Boolean))).map((cid: any) => {
              const c = contratoPorId.get(cid);
              const t = termoPorContrato.get(cid);
              if (!c) return null;
              const campo = (nome: string, rotulo: string, padrao: any, passo = "0.01") => (
                <label className="field" style={{ minWidth: 130 }}>{rotulo}
                  <input name={nome} type="number" min="0" step={passo} defaultValue={t?.[nome] ?? ""} placeholder={String(padrao ?? "")} />
                </label>
              );
              return (
                <details key={cid} style={{ marginBottom: 10 }} open={!!t}>
                  <summary style={{ cursor: "pointer" }}>
                    <b>Valores específicos de {mesRotulo(mes)}</b> — contrato {c.code}
                    {t ? <span className="badge warn" style={{ marginLeft: 8 }}>personalizado</span> : <span className="muted"> (usando os valores do contrato: mensalidade {moeda(c.monthly_fee)})</span>}
                  </summary>
                  <form action={salvarValores} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 8 }}>
                    <input type="hidden" name="mes" value={mes} />
                    <input type="hidden" name="contrato" value={cid} />
                    {campo("monthly_fee", "Mensalidade (R$)", c.monthly_fee)}
                    {campo("pages_included_bw", "Franquia P&B", c.pages_included_bw, "1")}
                    {campo("pages_included_color", "Franquia cor", c.pages_included_color, "1")}
                    {campo("extra_page_price_bw", "Página extra P&B (R$)", c.extra_page_price_bw, "0.0001")}
                    {campo("extra_page_price_color", "Página extra cor (R$)", c.extra_page_price_color, "0.0001")}
                    <label className="field" style={{ minWidth: 180, flex: 1 }}>Observação
                      <input name="note" defaultValue={t?.note ?? ""} />
                    </label>
                    <button className="btn secondary">Salvar valores</button>
                    <Link className="btn secondary" href={`/contratos/${cid}`}>Fechar mês / fatura</Link>
                  </form>
                  <p className="muted" style={{ margin: "6px 0 0" }}>Campo vazio = usa o valor do contrato (mostrado em cinza). Só vale para {mesRotulo(mes)}.</p>
                </details>
              );
            })}
            <table className="table">
              <thead>
                <tr>
                  <th>Impressora</th>
                  <th>Leitura anterior</th>
                  <th>Contador P&amp;B</th>
                  <th>Contador cor</th>
                  <th>Páginas no mês</th>
                </tr>
              </thead>
              <tbody>
                {g.itens.map((e) => {
                  const atual = leituraDoMes.get(e.id);
                  const ant = anterior.get(e.id);
                  const paginas = atual && ant ? Number(atual.counter_bw) - Number(ant.counter_bw) : null;
                  const paginasCor = atual && ant ? Number(atual.counter_color) - Number(ant.counter_color) : null;
                  return (
                    <tr key={e.id}>
                      <td>
                        <Link href={`/equipamentos/${e.id}`} style={{ color: "var(--link)", fontWeight: 800 }}>
                          {e.asset_tag ? `Patrimônio ${e.asset_tag}` : e.code ?? `Equip. ${e.equipment_number}`}
                        </Link>
                        <div className="muted">{e.brand} {e.model}{e.serial_number ? ` · série ${e.serial_number}` : ""}</div>
                        {ver === "cliente" && <div className="muted">{e.contracts?.code ?? (e.contract_id ? "em contrato" : "sem contrato")}</div>}
                      </td>
                      <td>
                        {ant ? (
                          <>
                            {ant.counter_bw} / {ant.counter_color}
                            <div className="muted">{mesRotulo(ant.reference_month)}</div>
                          </>
                        ) : (
                          <span className="muted">primeira leitura</span>
                        )}
                      </td>
                      <td colSpan={2}>
                        <form action={salvarLeitura} className="inline">
                          <input type="hidden" name="equipamento" value={e.id} />
                          <input type="hidden" name="mes" value={mes} />
                          <input name="counter_bw" type="number" min="0" step="1" placeholder="P&B" aria-label="Contador P&B" defaultValue={atual?.counter_bw ?? ""} required />
                          <input name="counter_color" type="number" min="0" step="1" placeholder="Cor" aria-label="Contador colorido" defaultValue={atual?.counter_color ?? 0} />
                          <button className="btn secondary">Salvar</button>
                        </form>
                      </td>
                      <td>
                        {paginas !== null ? (
                          <b>{paginas}{paginasCor ? ` + ${paginasCor} cor` : ""}</b>
                        ) : atual ? (
                          <span className="muted">—</span>
                        ) : (
                          <span className="badge warn">Falta ler</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
      {!ordenados.length && (
        <section className="card">
          <span className="muted">Nenhuma impressora encontrada com esses filtros.</span>
        </section>
      )}
    </main>
  );
}
