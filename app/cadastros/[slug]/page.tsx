import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { podeEditar, podeVer } from "@/lib/permissoes";
import { fmtData, moeda } from "@/lib/format";
import { CADASTROS } from "@/lib/cadastros";

async function criar(formData: FormData) {
  "use server";
  const cfg = CADASTROS[String(formData.get("slug"))];
  if (!cfg) return;
  const supabase = await createClient();
  const linha: Record<string, any> = {};
  for (const c of cfg.campos) {
    const bruto = String(formData.get(c.nome) ?? "").trim();
    if (!bruto) { if (c.obrigatorio) redirect(`/cadastros/${cfg.slug}?erro=` + encodeURIComponent(`Informe: ${c.rotulo}.`)); continue; }
    linha[c.nome] = c.tipo === "number" ? Number(bruto.replace(",", ".")) : bruto;
  }
  if (cfg.tabela === "stock_movements") {
    const motivo = cfg.slug === "consumo-interno" ? "consumo_interno" : linha.reason;
    const original = Number(linha.quantity);
    const q = Math.abs(original);
    linha.reason = motivo;
    linha.quantity = motivo === "saida" || motivo === "consumo_interno" ? -q : q; // ajuste usa o sinal digitado
    if (motivo === "ajuste") linha.quantity = original; // ajuste aceita sinal negativo
  }
  const { error } = await supabase.from(cfg.tabela).insert(linha);
  if (error) redirect(`/cadastros/${cfg.slug}?erro=` + encodeURIComponent(error.message));
  revalidatePath(`/cadastros/${cfg.slug}`);
  redirect(`/cadastros/${cfg.slug}`);
}

async function excluir(formData: FormData) {
  "use server";
  const cfg = CADASTROS[String(formData.get("slug"))];
  if (!cfg || cfg.tabela === "stock_movements") return;
  const supabase = await createClient();
  await supabase.from(cfg.tabela).delete().eq("id", String(formData.get("id")));
  revalidatePath(`/cadastros/${cfg.slug}`);
  redirect(`/cadastros/${cfg.slug}`);
}

async function alternar(formData: FormData) {
  "use server";
  const cfg = CADASTROS[String(formData.get("slug"))];
  if (!cfg) return;
  const campo = cfg.tabela === "tasks" ? "done" : cfg.tabela === "checklist_items" ? "active" : null;
  if (!campo) return;
  const supabase = await createClient();
  await supabase.from(cfg.tabela).update({ [campo]: formData.get("valor") !== "true" }).eq("id", String(formData.get("id")));
  revalidatePath(`/cadastros/${cfg.slug}`);
  redirect(`/cadastros/${cfg.slug}`);
}

const ROTULO: Record<string, string> = { entrada: "Entrada", saida: "Saída", ajuste: "Ajuste", consumo_interno: "Consumo interno" };

export default async function Cadastro({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { slug } = await params;
  const { erro } = await searchParams;
  const cfg = CADASTROS[slug];
  if (!cfg) notFound();
  const { supabase, perfil } = await getContexto();
  const perms = (perfil as any)?.permissions;
  if (!podeVer(perfil?.role, perms, cfg.area)) redirect("/dashboard");
  const editar = podeEditar(perfil?.role, perms, cfg.area);

  let consulta = supabase.from(cfg.tabela).select("*").order(cfg.ordem, { ascending: !cfg.desc, nullsFirst: false }).limit(500);
  if (cfg.tabela === "stock_movements" && slug === "consumo-interno") consulta = consulta.eq("reason", "consumo_interno");
  const { data } = await consulta;
  const linhas: any[] = data ?? [];
  const precisaPartes = cfg.campos.some((c) => c.tipo === "parte");
  const { data: partes } = precisaPartes ? await supabase.from("parts").select("id, name, stock_quantity").eq("active", true).order("name").limit(1000) : { data: [] as any[] };
  const nomeParte = new Map((partes ?? []).map((p: any) => [p.id, p.name]));
  const rotuloCol = (n: string) => ({ title: "Tarefa", description: "Detalhes", due_date: "Prazo", done: "Concluída", name: "Nome", active: "Ativo", adjust_percent: "Ajuste (%)", items_text: "Itens", transfer_date: "Data", from_account: "Origem", to_account: "Destino", amount: "Valor", notes: "Observações", created_at: "Data", part_id: "Produto", reason: "Tipo", quantity: "Quantidade" } as Record<string, string>)[n] ?? n;
  const mostra = (n: string, v: any) => {
    if (v === null || v === undefined || v === "") return "—";
    if (n === "done" || n === "active") return v ? "Sim" : "Não";
    if (n === "due_date" || n === "transfer_date" || n === "created_at") return fmtData(String(v));
    if (n === "amount") return moeda(Number(v));
    if (n === "part_id") return nomeParte.get(v) ?? "—";
    if (n === "reason") return ROTULO[v] ?? v;
    if (n === "quantity" || n === "adjust_percent") return String(Number(v));
    return String(v);
  };
  const temToggle = cfg.tabela === "tasks" || cfg.tabela === "checklist_items";

  return (
    <main className="wrap" style={{ maxWidth: 1000 }}>
      <h1 className="title">{cfg.titulo}</h1>
      <p className="muted">{cfg.ajuda}</p>
      {erro && <p className="alert">{erro}</p>}
      {editar && (
        <form action={criar} className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end", marginTop: 12 }}>
          <input type="hidden" name="slug" value={cfg.slug} />
          {cfg.campos.map((c) => (
            <label key={c.nome} style={{ flex: c.tipo === "textarea" ? "1 1 280px" : undefined }}>
              {c.rotulo}
              {c.tipo === "textarea" ? <textarea name={c.nome} rows={2} />
                : c.tipo === "parte" ? <select name={c.nome} required><option value="">Escolha…</option>{(partes ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name} (estoque {Number(p.stock_quantity)})</option>)}</select>
                : c.tipo === "select" ? <select name={c.nome} required>{c.opcoes!.map((o) => <option key={o} value={o}>{ROTULO[o] ?? o}</option>)}</select>
                : <input name={c.nome} type={c.tipo === "date" ? "date" : "text"} inputMode={c.tipo === "number" ? "decimal" : undefined} required={c.obrigatorio} />}
            </label>
          ))}
          <button className="btn primary">Adicionar</button>
        </form>
      )}
      <div className="card" style={{ marginTop: 12, overflowX: "auto" }}>
        <table>
          <thead><tr>{cfg.colunas.map((c) => <th key={c}>{rotuloCol(c)}</th>)}<th /></tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id}>
                {cfg.colunas.map((c) => <td key={c} style={{ whiteSpace: c === "items_text" || c === "description" ? "pre-wrap" : undefined }}>{mostra(c, l[c])}</td>)}
                <td style={{ whiteSpace: "nowrap" }}>
                  {editar && temToggle && (
                    <form action={alternar} style={{ display: "inline" }}>
                      <input type="hidden" name="slug" value={cfg.slug} /><input type="hidden" name="id" value={l.id} /><input type="hidden" name="valor" value={String(cfg.tabela === "tasks" ? l.done : l.active)} />
                      <button className="btn secondary">{cfg.tabela === "tasks" ? (l.done ? "Reabrir" : "Concluir") : l.active ? "Desativar" : "Ativar"}</button>
                    </form>
                  )}{" "}
                  {editar && cfg.tabela !== "stock_movements" && (
                    <form action={excluir} style={{ display: "inline" }}>
                      <input type="hidden" name="slug" value={cfg.slug} /><input type="hidden" name="id" value={l.id} />
                      <button className="btn secondary">Excluir</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!linhas.length && <tr><td colSpan={cfg.colunas.length + 1} className="muted">Nada cadastrado ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
