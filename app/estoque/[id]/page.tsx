import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { podeEditar, podeVer } from "@/lib/permissoes";
import { fmtData, moeda } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const ABAS: [string, string][] = [
  ["editar", "Editar Produto"],
  ["precos", "Preços de Venda"],
  ["fornecedores", "Fornecedores"],
  ["historico", "Histórico"],
  ["reajustes", "Reajustes"],
];

const volta = (id: string, aba: string) => `/estoque/${id}?aba=${aba}`;
const num = (v: FormDataEntryValue | null) => Number(String(v ?? "0").replace(",", ".")) || 0;

async function salvar(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const name = String(fd.get("name") || "").trim();
  if (!name) redirect(volta(id, "editar") + "&erro=" + encodeURIComponent("Informe a descrição."));
  const { error } = await supabase
    .from("parts")
    .update({
      name,
      unit: String(fd.get("unit") || "").trim() || null,
      barcode: String(fd.get("barcode") || "").trim() || null,
      code: String(fd.get("code") || "").trim() || null,
      group_id: String(fd.get("group_id") || "") || null,
      minimum_stock: num(fd.get("minimum_stock")),
      controla_estoque: fd.get("controla_estoque") === "on",
      active: fd.get("active") === "on",
    })
    .eq("id", id);
  if (error) redirect(volta(id, "editar") + "&erro=" + encodeURIComponent(error.code === "23505" ? "Código já usado em outro produto." : error.message));
  revalidatePath(`/estoque/${id}`);
  redirect(volta(id, "editar") + "&ok=1");
}

async function salvarPrecos(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const { error } = await supabase
    .from("part_prices")
    .upsert({ part_id: id, sale_price: num(fd.get("sale_price")), cost_price: num(fd.get("cost_price")) }, { onConflict: "part_id" });
  if (error) redirect(volta(id, "precos") + "&erro=" + encodeURIComponent(error.message));
  revalidatePath(`/estoque/${id}`);
  redirect(volta(id, "precos") + "&ok=1");
}

async function movimentar(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const tipo = String(fd.get("tipo"));
  const aba = String(fd.get("aba") || "editar");
  let q = num(fd.get("quantidade"));
  if (tipo === "reajuste") {
    const { data: p } = await supabase.from("parts").select("stock_quantity").eq("id", id).single();
    q = num(fd.get("novo_total")) - Number((p as any)?.stock_quantity ?? 0);
  } else if (q <= 0) redirect(volta(id, aba) + "&erro=" + encodeURIComponent("Informe uma quantidade maior que zero."));
  if (q === 0) redirect(volta(id, aba));
  const { error } = await supabase.from("stock_movements").insert({
    part_id: id,
    quantity: q,
    reason: tipo === "reajuste" ? "reajuste" : "entrada_manual",
    notes: String(fd.get("notes") || "").trim() || null,
  });
  if (error) redirect(volta(id, aba) + "&erro=" + encodeURIComponent(error.message));
  revalidatePath(`/estoque/${id}`);
  redirect(volta(id, aba) + "&ok=1");
}

async function addFornecedor(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const nome = String(fd.get("supplier_name") || "").trim();
  if (nome)
    await supabase.from("part_suppliers").insert({
      part_id: id,
      supplier_name: nome,
      supplier_code: String(fd.get("supplier_code") || "").trim() || null,
      last_cost: num(fd.get("last_cost")) || null,
    });
  revalidatePath(`/estoque/${id}`);
  redirect(volta(id, "fornecedores"));
}

async function delFornecedor(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  await supabase.from("part_suppliers").delete().eq("id", String(fd.get("sid")));
  revalidatePath(`/estoque/${id}`);
  redirect(volta(id, "fornecedores"));
}

async function clonar(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id"));
  const { data: p } = await supabase.from("parts").select("name, unit, description, group_id, minimum_stock, controla_estoque").eq("id", id).single();
  if (!p) redirect("/estoque");
  const { data: n, error } = await supabase
    .from("parts")
    .insert({ ...(p as any), name: `${(p as any).name} (cópia)`, stock_quantity: 0 })
    .select("id")
    .single();
  if (error || !n) redirect(volta(id, "editar") + "&erro=" + encodeURIComponent(error?.message ?? "Falha ao clonar."));
  const { data: pr } = await supabase.from("part_prices").select("sale_price, cost_price").eq("part_id", id).maybeSingle();
  if (pr) await supabase.from("part_prices").insert({ part_id: (n as any).id, ...(pr as any) });
  redirect(volta((n as any).id, "editar"));
}

export default async function Produto({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string; erro?: string; ok?: string }> }) {
  const { id } = await params;
  const { aba: a, erro, ok } = await searchParams;
  const aba = ABAS.some(([k]) => k === a) ? a! : "editar";
  const { supabase, perfil } = await getContexto();
  const perms = (perfil as any)?.permissions;
  const verFin = podeVer(perfil?.role, perms, "financeiro");
  const editar = podeEditar(perfil?.role, perms, "pecas");
  const { data: p } = await supabase.from("parts").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const part: any = p;
  const [{ data: pr }, { data: grupos }, { data: forn }, { data: movs }, { data: listas }] = await Promise.all([
    verFin ? supabase.from("part_prices").select("sale_price, cost_price").eq("part_id", id).maybeSingle() : Promise.resolve({ data: null } as any),
    supabase.from("part_groups").select("id, name").order("name"),
    supabase.from("part_suppliers").select("*").eq("part_id", id).order("created_at", { ascending: false }),
    supabase.from("stock_movements").select("*").eq("part_id", id).order("created_at", { ascending: false }).limit(200),
    supabase.from("price_lists").select("id, name, adjust_percent").order("name"),
  ]);
  const venda = Number((pr as any)?.sale_price ?? 0);
  const custo = Number((pr as any)?.cost_price ?? 0);
  const margem = custo > 0 ? ((venda - custo) / custo) * 100 : null;
  const dis = !editar;

  return (
    <main className="wrap">
      <p className="muted">
        <Link href="/estoque">Produtos</Link> › Editar
      </p>
      <h1 className="title">
        #Produto: {part.code ?? part.id.slice(0, 6)} {!part.active && <span className="badge warn">Inativo</span>}
      </h1>
      {erro && <div className="error" style={{ margin: "10px 0" }}>{erro}</div>}
      {ok && <div className="os-ok" style={{ margin: "10px 0" }}>Salvo com sucesso.</div>}

      <nav className="os-abas">
        {ABAS.map(([k, n]) => (
          <Link key={k} href={volta(id, k)} className={k === aba ? "ativa" : ""}>
            {n}
          </Link>
        ))}
      </nav>

      <section className="card os-painel">
        {aba === "editar" && (
          <form action={salvar} className="grid g3">
            <input type="hidden" name="id" value={id} />
            <label className="field" style={{ gridColumn: "span 2" }}>
              Descrição do produto
              <input name="name" defaultValue={part.name} required disabled={dis} />
            </label>
            <label className="field">
              Unidade
              <input name="unit" list="unidades" defaultValue={part.unit ?? "Unidade"} disabled={dis} />
              <datalist id="unidades">{["Unidade", "Peça", "Caixa", "Pacote", "Metro", "Litro", "Kg"].map((u) => <option key={u} value={u} />)}</datalist>
            </label>
            {verFin && (
              <div style={{ gridColumn: "1/-1", display: "flex", gap: 24, flexWrap: "wrap" }}>
                <span>Compra: <b>{moeda(custo)}</b></span>
                <span>Venda: <b>{moeda(venda)}</b></span>
                <span>Margem: <b>{margem === null ? "—" : margem.toFixed(2).replace(".", ",") + "%"}</b></span>
              </div>
            )}
            <label className="field">
              Grupo
              <select name="group_id" defaultValue={part.group_id ?? ""} disabled={dis}>
                <option value="">Selecione um grupo...</option>
                {(grupos ?? []).map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
            <label className="field">
              Código
              <input name="code" defaultValue={part.code ?? ""} disabled={dis} />
            </label>
            <label className="field">
              Código de barras
              <input name="barcode" defaultValue={part.barcode ?? ""} placeholder="Ex: 2000000012345" disabled={dis} />
            </label>
            <label className="field">
              Estoque mínimo
              <input name="minimum_stock" type="number" step="1" defaultValue={part.minimum_stock} disabled={dis} />
            </label>
            <label className="field" style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="controla_estoque" defaultChecked={part.controla_estoque} disabled={dis} /> Controle de estoque
            </label>
            <label className="field" style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="active" defaultChecked={part.active} disabled={dis} /> Ativo
            </label>
            <div style={{ gridColumn: "1/-1" }}>
              <b style={{ fontSize: 22 }}>{part.stock_quantity}</b> <span className="muted">unidades em estoque</span>
            </div>
            {editar && (
              <div style={{ gridColumn: "1/-1", display: "flex", gap: 8 }}>
                <button className="btn primary">Salvar</button>
                <Link className="btn secondary" href="/estoque">Voltar</Link>
              </div>
            )}
          </form>
        )}
        {aba === "editar" && editar && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
            <form action={movimentar} className="inline">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="tipo" value="entrada" />
              <input name="quantidade" type="number" min="1" step="1" placeholder="Qtd" aria-label="Quantidade" />
              <button className="btn secondary">Adicionar estoque</button>
            </form>
            <form action={clonar}>
              <input type="hidden" name="id" value={id} />
              <button className="btn secondary">Clonar</button>
            </form>
          </div>
        )}

        {aba === "precos" &&
          (verFin ? (
            <>
              <form action={salvarPrecos} className="grid g3">
                <input type="hidden" name="id" value={id} />
                <label className="field">
                  Preço de custo
                  <input name="cost_price" inputMode="decimal" defaultValue={custo} disabled={!podeEditar(perfil?.role, perms, "financeiro")} />
                </label>
                <label className="field">
                  Preço de venda
                  <input name="sale_price" inputMode="decimal" defaultValue={venda} disabled={!podeEditar(perfil?.role, perms, "financeiro")} />
                </label>
                {podeEditar(perfil?.role, perms, "financeiro") && (
                  <div style={{ alignSelf: "end" }}>
                    <button className="btn primary">Salvar preços</button>
                  </div>
                )}
              </form>
              <h3>Listas de preços</h3>
              <table className="table">
                <thead>
                  <tr><th>Lista</th><th>Ajuste</th><th>Preço na lista</th></tr>
                </thead>
                <tbody>
                  <tr><td>Padrão</td><td>—</td><td>{moeda(venda)}</td></tr>
                  {(listas ?? []).map((l: any) => (
                    <tr key={l.id}>
                      <td>{l.name}</td>
                      <td>{Number(l.adjust_percent)}%</td>
                      <td>{moeda(venda * (1 + Number(l.adjust_percent) / 100))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="muted">Sem permissão para ver preços.</p>
          ))}

        {aba === "fornecedores" && (
          <>
            {editar && (
              <form action={addFornecedor} className="grid g4">
                <input type="hidden" name="id" value={id} />
                <label className="field">Fornecedor<input name="supplier_name" required /></label>
                <label className="field">Código no fornecedor<input name="supplier_code" /></label>
                {verFin && <label className="field">Último custo<input name="last_cost" inputMode="decimal" /></label>}
                <div style={{ alignSelf: "end" }}><button className="btn primary">Adicionar</button></div>
              </form>
            )}
            <table className="table" style={{ marginTop: 12 }}>
              <thead><tr><th>Fornecedor</th><th>Código</th>{verFin && <th>Último custo</th>}<th></th></tr></thead>
              <tbody>
                {(forn ?? []).map((f: any) => (
                  <tr key={f.id}>
                    <td>{f.supplier_name}</td>
                    <td>{f.supplier_code ?? "—"}</td>
                    {verFin && <td>{f.last_cost != null ? moeda(f.last_cost) : "—"}</td>}
                    <td>
                      {editar && (
                        <form action={delFornecedor}>
                          <input type="hidden" name="id" value={id} />
                          <input type="hidden" name="sid" value={f.id} />
                          <button className="btn secondary">Remover</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!(forn ?? []).length && <p className="muted">Nenhum fornecedor vinculado.</p>}
          </>
        )}

        {aba === "historico" && (
          <>
            <table className="table">
              <thead><tr><th>Data</th><th>Tipo</th><th>Quantidade</th><th>Observação</th></tr></thead>
              <tbody>
                {(movs ?? []).map((m: any) => (
                  <tr key={m.id}>
                    <td>{fmtData(m.created_at)}</td>
                    <td>{String(m.reason ?? "").replace(/_/g, " ")}</td>
                    <td style={{ color: Number(m.quantity) < 0 ? "#c0392b" : "#1e8449" }}>{Number(m.quantity) > 0 ? "+" : ""}{Number(m.quantity)}</td>
                    <td>{m.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!(movs ?? []).length && <p className="muted">Sem movimentações registradas.</p>}
          </>
        )}

        {aba === "reajustes" && (
          <>
            <p className="muted">Informe a contagem real do estoque; o sistema registra a diferença no histórico.</p>
            <p>Estoque atual: <b>{part.stock_quantity}</b></p>
            {editar && (
              <form action={movimentar} className="grid g3">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="tipo" value="reajuste" />
                <input type="hidden" name="aba" value="reajustes" />
                <label className="field">Novo total<input name="novo_total" type="number" step="1" required /></label>
                <label className="field">Motivo<input name="notes" placeholder="Ex.: inventário" /></label>
                <div style={{ alignSelf: "end" }}><button className="btn primary">Reajustar estoque</button></div>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}
