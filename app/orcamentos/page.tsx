import Link from "next/link";
import { redirect } from "next/navigation";
import ConfigTabela from "@/components/config-tabela";
import { getContexto } from "@/lib/contexto";
import { fmtData, moeda } from "@/lib/format";
import { podeEditar } from "@/lib/permissoes";
import { lerConfig } from "@/lib/config";

async function novo() {
  "use server";
  const { supabase } = await getContexto();
  const cfg = await lerConfig(supabase);
  const { data: ult } = await supabase.from("quotes").select("number").order("number", { ascending: false }).limit(1);
  const number = Number((ult as any)?.[0]?.number ?? 0) + 1;
  const validade = new Date(Date.now() + cfg.orcamento_validade_dias * 86400000).toISOString();
  const { data, error } = await supabase.from("quotes").insert({ number, valid_until: validade }).select("id").single();
  if (error) redirect("/orcamentos?erro=" + encodeURIComponent(error.message));
  await supabase.from("quote_options").insert({ quote_id: (data as any).id, position: 1, name: "Opção 1" });
  redirect(`/orcamentos/${(data as any).id}`);
}

export const STATUS_ORC: Record<string, string> = { rascunho: "Rascunho", enviado: "Enviado", aprovado: "Aprovado", reprovado: "Reprovado", convertido: "Convertido" };

export default async function Orcamentos({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; erro?: string }> }) {
  const { f, q, erro } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const editar = podeEditar(perfil?.role, (perfil as any)?.permissions, "os");
  const { data } = await supabase
    .from("quotes")
    .select("id, number, title, status, origin, valid_until, created_at, clients(name), profiles:seller_id(full_name), quote_options(id, position, quote_items(quantity, unit_price, discount))")
    .order("number", { ascending: false })
    .limit(500);
  const agora = Date.now();
  const todos: any[] = (data ?? []).map((o: any) => {
    const op = [...(o.quote_options ?? [])].sort((a: any, b: any) => a.position - b.position)[0];
    const valor = (op?.quote_items ?? []).reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price) - Number(i.discount), 0);
    const vencido = o.valid_until && new Date(o.valid_until).getTime() < agora && ["rascunho", "enviado"].includes(o.status);
    return { ...o, valor, vencido };
  });
  const abertos = todos.filter((o) => ["rascunho", "enviado"].includes(o.status));
  const t = (q ?? "").trim().toLowerCase();
  const lista = todos.filter((o) => {
    if (f === "abertos" && !abertos.includes(o)) return false;
    if (f === "aprovados" && !["aprovado", "convertido"].includes(o.status)) return false;
    if (f === "reprovados" && o.status !== "reprovado") return false;
    if (!f && false) return false;
    return !t || [String(o.number), o.title, o.clients?.name].filter(Boolean).some((x: string) => x.toLowerCase().includes(t));
  });
  const n = (fn: (o: any) => boolean) => todos.filter(fn).length;

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="title">Orçamento Express</h1>
          <div className="muted">Propostas rápidas para o cliente aprovar, e os modelos para reaproveitar</div>
        </div>
        {editar && <form action={novo}><button className="btn primary">+ Novo orçamento</button></form>}
      </div>
      {erro && <div className="error" style={{ marginBottom: 10 }}>{erro}</div>}
      <nav className="os-sub" style={{ marginBottom: 12 }}>
        <Link href="/orcamentos" className="ativa">Orçamentos</Link>
        <Link href="/modulo/modelos-orcamento">Modelos</Link>
      </nav>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <Link className={!f ? "btn primary" : "btn secondary"} href="/orcamentos">Todos {todos.length}</Link>
        <Link className={f === "abertos" ? "btn primary" : "btn secondary"} href="/orcamentos?f=abertos">Em aberto {abertos.length}</Link>
        <Link className={f === "aprovados" ? "btn primary" : "btn secondary"} href="/orcamentos?f=aprovados">Aprovados {n((o) => ["aprovado", "convertido"].includes(o.status))}</Link>
        <Link className={f === "reprovados" ? "btn primary" : "btn secondary"} href="/orcamentos?f=reprovados">Reprovados {n((o) => o.status === "reprovado")}</Link>
        <form style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {f && <input type="hidden" name="f" value={f} />}
          <input name="q" defaultValue={q ?? ""} placeholder="Buscar" />
          <button className="btn secondary">Buscar</button>
        </form>
      </div>
      <section className="card" style={{ overflowX: "auto" }}>
        <ConfigTabela chave="orcamentos" />
        <table className="table">
          <thead><tr><th>#</th><th>Origem</th><th>Título</th><th>Cliente</th><th>Vendedor</th><th>Status</th><th>Valor</th><th>Validade</th><th>Criado em</th><th>Ações</th></tr></thead>
          <tbody>
            {lista.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/orcamentos/${o.id}`} style={{ color: "var(--link)", fontWeight: 800 }}>{o.number}</Link></td>
                <td><span className="badge">{o.origin}</span></td>
                <td>{o.title ?? "—"}</td>
                <td>{o.clients?.name ?? "—"}</td>
                <td>{o.profiles?.full_name ?? "—"}</td>
                <td><span className="badge" style={o.vencido ? { background: "#fee2e2", color: "#991b1b" } : undefined}>{o.vencido ? "Vencido" : STATUS_ORC[o.status] ?? o.status}</span></td>
                <td><b>{moeda(o.valor)}</b></td>
                <td>{o.valid_until ? fmtData(o.valid_until) : "—"}</td>
                <td>{fmtData(o.created_at)}</td>
                <td><Link className="btn primary" href={`/orcamentos/${o.id}`} title="Editar">✎</Link></td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={10} className="muted" style={{ textAlign: "center" }}>Nenhum orçamento.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
