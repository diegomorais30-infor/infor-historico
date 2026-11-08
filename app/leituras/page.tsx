import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { hojeBR, mesRotulo, somaMes } from "@/lib/format";

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

export default async function Leituras({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; erro?: string; aviso?: string; ver?: string; cliente?: string; escopo?: string; q?: string }>;
}) {
  const { mes: mesParam, erro, ver: verParam, cliente: clienteSel, escopo: escopoParam, q } = await searchParams;
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
