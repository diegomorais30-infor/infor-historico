import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { podeEditar, podeVer } from "@/lib/permissoes";
import { moeda } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

async function criarPeca(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/estoque?erro=" + encodeURIComponent("Informe o nome da peça."));
  const code = String(formData.get("code") || "").trim();
  const aba = String(formData.get("aba") || "").trim();
  const secao = String(formData.get("secao") || "").trim();
  const grupo = [aba, secao].filter(Boolean).join(" · ");

  const { error } = await supabase.from("parts").insert({
    name,
    code: code || null,
    description: grupo || null,
    stock_quantity: Number(formData.get("stock_quantity")) || 0,
    minimum_stock: Number(formData.get("minimum_stock")) || 0,
  });
  if (error) {
    const texto = error.code === "23505" ? "Já existe uma peça com esse código." : error.message;
    redirect("/estoque?erro=" + encodeURIComponent(texto));
  }
  revalidatePath("/estoque");
  redirect("/estoque?aba=" + encodeURIComponent(aba));
}

async function salvarPrecos(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const part_id = String(formData.get("id"));
  const num = (k: string) => Number(String(formData.get(k) || "0").replace(",", ".")) || 0;
  const aba = String(formData.get("aba") || "");
  const { error } = await supabase
    .from("part_prices")
    .upsert({ part_id, sale_price: num("sale_price"), cost_price: num("cost_price") }, { onConflict: "part_id" });
  if (error) redirect("/estoque?erro=" + encodeURIComponent(error.message));
  revalidatePath("/estoque");
  redirect("/estoque?aba=" + encodeURIComponent(aba));
}

async function registrarEntrada(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id"));
  const quantidade = Number(formData.get("quantidade")) || 0;
  if (!id || quantidade <= 0) redirect("/estoque?erro=" + encodeURIComponent("Informe uma quantidade maior que zero."));

  const { data: peca } = await supabase.from("parts").select("stock_quantity").eq("id", id).single();
  if (!peca) redirect("/estoque?erro=" + encodeURIComponent("Peça não encontrada."));

  const { error } = await supabase
    .from("parts")
    .update({ stock_quantity: Number(peca.stock_quantity) + quantidade })
    .eq("id", id);
  if (error) redirect("/estoque?erro=" + encodeURIComponent(error.message));

  revalidatePath("/estoque");
  redirect("/estoque");
}

export default async function Estoque({ searchParams }: { searchParams: Promise<{ erro?: string; aba?: string; q?: string }> }) {
  const { erro, aba: abaSel, q } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const verFin = podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro");
  const editFin = podeEditar(perfil?.role, (perfil as any)?.permissions, "financeiro");
  const { data } = await supabase.from("parts").select("*").eq("active", true).order("name");
  const todas: any[] = data ?? [];
  const precos: Record<string, any> = {};
  if (verFin) {
    const { data: pp } = await supabase.from("part_prices").select("part_id, sale_price, cost_price");
    for (const r of pp ?? []) precos[(r as any).part_id] = r;
  }
  const abaDe = (p: any) => String(p.description ?? "").split(" · ")[0] || "Outros";
  const secaoDe = (p: any) => String(p.description ?? "").split(" · ")[1] || "";
  const abas: string[] = [];
  for (const p of todas) if (!abas.includes(abaDe(p))) abas.push(abaDe(p));
  const secoes: string[] = [];
  for (const p of todas) if (secaoDe(p) && !secoes.includes(secaoDe(p))) secoes.push(secaoDe(p));
  const busca = (q ?? "").trim().toLowerCase();
  const abaAtual = abaSel && abas.includes(abaSel) ? abaSel : abas[0];
  const pecas = todas.filter((p) =>
    busca ? `${p.name} ${p.code ?? ""}`.toLowerCase().includes(busca) : abaDe(p) === abaAtual
  );
  const grupos: { secao: string; itens: any[] }[] = [];
  for (const p of pecas) {
    const sec = busca ? `${abaDe(p)}${secaoDe(p) ? " · " + secaoDe(p) : ""}` : secaoDe(p);
    let g = grupos.find((x) => x.secao === sec);
    if (!g) grupos.push((g = { secao: sec, itens: [] }));
    g.itens.push(p);
  }
  const contagem = (a: string) => todas.filter((p) => abaDe(p) === a).length;

  return (
    <main className="wrap">
      <h1 className="title">Estoque</h1>
      <p className="muted">O estoque baixa sozinho quando a peça é usada numa manutenção.</p>

      {erro && (
        <div className="error" style={{ margin: "14px 0" }}>
          {erro}
        </div>
      )}

      <nav className="tabs" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        {abas.map((a) => (
          <Link key={a} href={`/estoque?aba=${encodeURIComponent(a)}`} title={a} className={`btn aba ${a === abaAtual && !busca ? "primary" : "secondary"}`}>
            {a} ({contagem(a)})
          </Link>
        ))}
      </nav>
      <form method="get" className="inline" style={{ marginTop: 12 }}>
        <input name="q" defaultValue={q ?? ""} placeholder="Buscar em todo o estoque" aria-label="Buscar" />
        <button className="btn secondary">Buscar</button>
      </form>

      <form action={criarPeca} className="card grid g4" style={{ margin: "18px 0" }}>
        <label className="field">
          Nome
          <input name="name" required />
        </label>
        <label className="field">
          Código
          <input name="code" />
        </label>
        <label className="field">
          Aba
          <input name="aba" list="abas" defaultValue={abaAtual} placeholder="Ex.: Peças" />
          <datalist id="abas">{abas.map((a) => <option key={a} value={a} />)}</datalist>
        </label>
        <label className="field">
          Seção / marca
          <input name="secao" list="secoes" placeholder="Ex.: Brother" />
          <datalist id="secoes">{secoes.map((a) => <option key={a} value={a} />)}</datalist>
        </label>
        <label className="field">
          Estoque atual
          <input name="stock_quantity" type="number" min="0" step="1" defaultValue="0" />
        </label>
        <label className="field">
          Estoque mínimo
          <input name="minimum_stock" type="number" min="0" step="1" defaultValue="0" />
        </label>
        <div style={{ gridColumn: "1/-1" }}>
          <button className="btn primary">Cadastrar item</button>
        </div>
      </form>

      {grupos.map((g) => (
        <section className="card" key={g.secao} style={{ marginBottom: 16 }}>
          {g.secao && <h2 style={{ marginTop: 0 }}>{g.secao}</h2>}
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Código</th>
                <th>Estoque</th>
                <th>Mínimo</th>
                <th>Entrada</th>
                {verFin && <th>Custo / Venda</th>}
              </tr>
            </thead>
            <tbody>
              {g.itens.map((p) => {
                const baixo = Number(p.stock_quantity) <= Number(p.minimum_stock);
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.code ?? "—"}</td>
                    <td>
                      <b>{p.stock_quantity}</b> {baixo && <span className="badge warn">Repor</span>}
                    </td>
                    <td>{p.minimum_stock}</td>
                    <td>
                      <form action={registrarEntrada} className="inline">
                        <input type="hidden" name="id" value={p.id} />
                        <input name="quantidade" type="number" min="1" step="1" placeholder="Qtd" aria-label="Quantidade" />
                        <button className="btn secondary">Adicionar</button>
                      </form>
                    </td>
                    {verFin && (
                      <td>
                        {editFin ? (
                          <form action={salvarPrecos} className="inline">
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="aba" value={abaAtual ?? ""} />
                            <input name="cost_price" inputMode="decimal" defaultValue={precos[p.id]?.cost_price ?? 0} aria-label="Custo" style={{ width: 80 }} />
                            <input name="sale_price" inputMode="decimal" defaultValue={precos[p.id]?.sale_price ?? 0} aria-label="Venda" style={{ width: 80 }} />
                            <button className="btn secondary">Salvar</button>
                          </form>
                        ) : (
                          <>
                            {moeda(precos[p.id]?.cost_price)} / {moeda(precos[p.id]?.sale_price)}
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
      {!grupos.length && <p className="muted">Nenhum item encontrado.</p>}
    </main>
  );
}
