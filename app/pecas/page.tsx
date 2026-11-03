import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";

async function criarPeca(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/pecas?erro=" + encodeURIComponent("Informe o nome da peça."));
  const code = String(formData.get("code") || "").trim();

  const { error } = await supabase.from("parts").insert({
    name,
    code: code || null,
    description: String(formData.get("description") || "").trim() || null,
    stock_quantity: Number(formData.get("stock_quantity")) || 0,
    minimum_stock: Number(formData.get("minimum_stock")) || 0,
  });
  if (error) {
    const texto = error.code === "23505" ? "Já existe uma peça com esse código." : error.message;
    redirect("/pecas?erro=" + encodeURIComponent(texto));
  }
  revalidatePath("/pecas");
  redirect("/pecas");
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
  if (!id || quantidade <= 0) redirect("/pecas?erro=" + encodeURIComponent("Informe uma quantidade maior que zero."));

  const { data: peca } = await supabase.from("parts").select("stock_quantity").eq("id", id).single();
  if (!peca) redirect("/pecas?erro=" + encodeURIComponent("Peça não encontrada."));

  const { error } = await supabase
    .from("parts")
    .update({ stock_quantity: Number(peca.stock_quantity) + quantidade })
    .eq("id", id);
  if (error) redirect("/pecas?erro=" + encodeURIComponent(error.message));

  revalidatePath("/pecas");
  redirect("/pecas");
}

export default async function Pecas({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const { supabase } = await getContexto();
  const { data } = await supabase.from("parts").select("*").eq("active", true).order("name");
  const pecas: any[] = data ?? [];

  return (
    <main className="wrap">
      <h1 className="title">Peças e suprimentos</h1>
      <p className="muted">O estoque baixa sozinho quando a peça é usada numa manutenção.</p>

      {erro && (
        <div className="error" style={{ margin: "14px 0" }}>
          {erro}
        </div>
      )}

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
          Estoque atual
          <input name="stock_quantity" type="number" min="0" step="1" defaultValue="0" />
        </label>
        <label className="field">
          Estoque mínimo
          <input name="minimum_stock" type="number" min="0" step="1" defaultValue="0" />
        </label>
        <div style={{ gridColumn: "1/-1" }}>
          <button className="btn primary">Cadastrar peça</button>
        </div>
      </form>

      <section className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Peça</th>
              <th>Código</th>
              <th>Estoque</th>
              <th>Mínimo</th>
              <th>Entrada</th>
            </tr>
          </thead>
          <tbody>
            {pecas.map((p) => {
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
                </tr>
              );
            })}
            {!pecas.length && (
              <tr>
                <td colSpan={5} className="muted">
                  Nenhuma peça cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
