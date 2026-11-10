import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { fmtData } from "@/lib/format";

async function nova(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  const title = String(fd.get("title") || "").trim();
  if (!title) redirect("/tarefas?erro=" + encodeURIComponent("Escreva a mensagem da tarefa."));
  const os = String(fd.get("os") || "").replace(/\D/g, "");
  let order_id: string | null = null;
  if (os) {
    const { data: o } = await supabase.from("service_orders").select("id").eq("number", Number(os)).maybeSingle();
    if (!o) redirect("/tarefas?erro=" + encodeURIComponent(`OS ${os} não encontrada.`));
    order_id = (o as any).id;
  }
  const { error } = await supabase.from("tasks").insert({
    title,
    assignee_id: String(fd.get("assignee_id") || "") || null,
    remind_at: String(fd.get("remind_at") || "") || null,
    due_date: String(fd.get("remind_at") || "") || null,
    order_id,
    created_by: u.user?.id ?? null,
  });
  if (error) redirect("/tarefas?erro=" + encodeURIComponent(error.message));
  revalidatePath("/tarefas");
  redirect("/tarefas");
}

async function alternar(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const tabela = String(fd.get("src")) === "os" ? "os_tasks" : "tasks";
  await supabase.from(tabela).update({ done: String(fd.get("done")) !== "true" }).eq("id", String(fd.get("id")));
  revalidatePath("/tarefas");
  redirect("/tarefas" + (String(fd.get("ver")) === "todas" ? "?ver=todas" : ""));
}

async function excluir(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const tabela = String(fd.get("src")) === "os" ? "os_tasks" : "tasks";
  await supabase.from(tabela).delete().eq("id", String(fd.get("id")));
  revalidatePath("/tarefas");
  redirect("/tarefas");
}

export default async function Tarefas({ searchParams }: { searchParams: Promise<{ ver?: string; q?: string; erro?: string }> }) {
  const { ver, q, erro } = await searchParams;
  const { supabase, perfil, user } = await getContexto() as any;
  const meuId: string | undefined = user?.id ?? (perfil as any)?.id;
  const todas = ver === "todas";
  const [{ data: t1 }, { data: t2 }, { data: pessoas }] = await Promise.all([
    supabase.from("tasks").select("id, title, due_date, remind_at, done, assignee_id, created_by, created_at, order_id, service_orders(number)").order("created_at", { ascending: false }).limit(1000),
    supabase.from("os_tasks").select("id, title, done, assignee_id, created_by, created_at, order_id, service_orders(number)").order("created_at", { ascending: false }).limit(1000),
    supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name"),
  ]);
  const nome = (id?: string | null) => (pessoas ?? []).find((p: any) => p.id === id)?.full_name ?? "—";
  let itens: any[] = [
    ...(t1 ?? []).map((t: any) => ({ ...t, src: "tarefa", lembrete: t.remind_at ?? t.due_date })),
    ...(t2 ?? []).map((t: any) => ({ ...t, src: "os", lembrete: null })),
  ];
  const minhas = itens.filter((t) => t.assignee_id === meuId || (!t.assignee_id && t.created_by === meuId));
  const termo = (q ?? "").trim().toLowerCase();
  if (!todas) itens = minhas;
  if (termo) itens = itens.filter((t) => `${t.title} ${nome(t.assignee_id)}`.toLowerCase().includes(termo));
  const pend = itens.filter((t) => !t.done);
  const feitas = itens.filter((t) => t.done);
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

  const Linha = ({ t }: { t: any }) => (
    <tr key={t.src + t.id}>
      <td>
        <form action={alternar}>
          <input type="hidden" name="id" value={t.id} /><input type="hidden" name="src" value={t.src} /><input type="hidden" name="done" value={String(!!t.done)} /><input type="hidden" name="ver" value={todas ? "todas" : ""} />
          <button className="btn secondary" aria-label="Alternar" title={t.done ? "Reabrir" : "Concluir"}>{t.done ? "☑" : "☐"}</button>
        </form>
      </td>
      <td style={{ textDecoration: t.done ? "line-through" : "none" }}>{t.title}</td>
      <td>{t.service_orders?.number ? <Link href={`/os/${t.order_id}?aba=tarefas`}>OS #{t.service_orders.number}</Link> : "—"}</td>
      <td>{nome(t.assignee_id)}</td>
      <td style={{ color: !t.done && t.lembrete && t.lembrete < hoje ? "#dc2626" : undefined }}>{t.lembrete ? fmtData(t.lembrete) : "—"}</td>
      <td>{nome(t.created_by)}</td>
      <td>
        <form action={excluir}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="src" value={t.src} /><button className="btn secondary">Excluir</button></form>
      </td>
    </tr>
  );

  return (
    <main className="wrap">
      <h1 className="title">Tarefas</h1>
      <p className="muted">Lembretes e pendências da equipe, por responsável</p>
      {erro && <div className="error" style={{ margin: "10px 0" }}>{erro}</div>}
      <form action={nova} className="card grid g4" style={{ margin: "12px 0" }}>
        <label className="field" style={{ gridColumn: "span 2" }}>Mensagem<input name="title" required /></label>
        <label className="field">Responsável
          <select name="assignee_id" defaultValue={meuId ?? ""}>
            <option value="">—</option>
            {(pessoas ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </label>
        <label className="field">Lembrete<input type="date" name="remind_at" /></label>
        <label className="field">Referência (nº da OS)<input name="os" inputMode="numeric" /></label>
        <div style={{ alignSelf: "end" }}><button className="btn primary">+ Nova tarefa</button></div>
      </form>
      <nav className="os-abas">
        <Link href="/tarefas" className={!todas ? "ativa" : ""}>Minhas <span className="os-cont">{minhas.filter((t) => !t.done).length}</span></Link>
        <Link href="/tarefas?ver=todas" className={todas ? "ativa" : ""}>Todas <span className="os-cont">{[...(t1 ?? []), ...(t2 ?? [])].filter((t: any) => !t.done).length}</span></Link>
      </nav>
      <section className="card os-painel" style={{ overflowX: "auto" }}>
        <form method="get" className="inline" style={{ marginBottom: 10 }}>
          {todas && <input type="hidden" name="ver" value="todas" />}
          <input name="q" defaultValue={q ?? ""} placeholder="Buscar" aria-label="Buscar" />
          <button className="btn secondary">Buscar</button>
        </form>
        <p className="muted" style={{ textAlign: "right", margin: 0 }}>{pend.length} pendentes</p>
        <table className="table">
          <thead><tr><th>Feito</th><th>Mensagem</th><th>Referência</th><th>Responsável</th><th>Lembrete</th><th>Criado por</th><th>Ações</th></tr></thead>
          <tbody>
            {pend.map((t) => <Linha key={t.src + t.id} t={t} />)}
            {!pend.length && <tr><td colSpan={7} className="muted">Nenhuma tarefa pendente.</td></tr>}
          </tbody>
        </table>
        <details style={{ marginTop: 12 }}>
          <summary>Concluídas <span className="os-cont">{feitas.length}</span></summary>
          <table className="table"><tbody>{feitas.map((t) => <Linha key={t.src + t.id} t={t} />)}</tbody></table>
        </details>
      </section>
    </main>
  );
}
