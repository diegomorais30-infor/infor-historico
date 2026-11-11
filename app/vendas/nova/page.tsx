import Link from "next/link";
import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { podeEditar } from "@/lib/permissoes";
import { createClient } from "@/lib/supabase/server";
import { hojeBR } from "@/lib/format";

async function criar(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const client_id = String(fd.get("client_id") || "");
  if (!client_id) redirect("/vendas/nova?erro=" + encodeURIComponent("Escolha o cliente."));
  const { data: ult } = await supabase.from("sales").select("number").order("number", { ascending: false }).limit(1);
  const number = Number((ult as any)?.[0]?.number ?? 0) + 1;
  const { data, error } = await supabase
    .from("sales")
    .insert({
      number,
      client_id,
      sold_at: String(fd.get("sold_at") || "") || hojeBR(),
      seller: String(fd.get("seller") || "").trim() || null,
      origin: String(fd.get("origin") || "").trim() || null,
      notes: String(fd.get("notes") || "").trim() || null,
      warranty_term: String(fd.get("warranty_term") || "").trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) redirect("/vendas/nova?erro=" + encodeURIComponent(error?.message ?? "Erro ao criar."));
  redirect(`/vendas/${(data as any).id}`);
}

export default async function NovaVenda({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const { supabase, perfil } = await getContexto();
  if (!podeEditar(perfil?.role, (perfil as any)?.permissions, "financeiro")) redirect("/vendas");
  const [{ data: clientes }, { data: termos }, { data: eu }] = await Promise.all([
    supabase.from("clients").select("id, name").eq("active", true).order("name").limit(2000),
    supabase.from("warranty_terms").select("name").order("name"),
    supabase.from("profiles").select("full_name").eq("id", (await supabase.auth.getUser()).data.user?.id ?? "").maybeSingle(),
  ]);
  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <h1 className="title">Nova venda</h1>
      <p className="muted">Cliente, produtos e a garantia da venda</p>
      {erro && <div className="error" style={{ margin: "10px 0" }}>{erro}</div>}
      <form action={criar} className="card grid g3">
        <label className="field" style={{ gridColumn: "span 2" }}>
          Cliente
          <select name="client_id" required defaultValue="">
            <option value="">Digite/escolha o cliente…</option>
            {(clientes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Link href="/clientes/novo" style={{ fontSize: 13, color: "var(--link)" }}>+ Cliente (cadastrar um novo)</Link>
        </label>
        <label className="field">
          Vendedor
          <input name="seller" defaultValue={(eu as any)?.full_name ?? ""} />
        </label>
        <label className="field">
          Data da venda
          <input type="date" name="sold_at" defaultValue={hojeBR()} />
        </label>
        <label className="field">
          Origem do cliente
          <input name="origin" />
        </label>
        <label className="field">
          Termos de garantia
          <select name="warranty_term" defaultValue="">
            <option value="">----</option>
            {(termos ?? []).map((t: any) => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
        </label>
        <label className="field" style={{ gridColumn: "1/-1" }}>
          Observações
          <input name="notes" />
        </label>
        <div style={{ gridColumn: "1/-1", display: "flex", gap: 8 }}>
          <button className="btn primary">Salvar e adicionar produtos</button>
          <Link className="btn secondary" href="/vendas">Voltar</Link>
        </div>
      </form>
    </main>
  );
}
