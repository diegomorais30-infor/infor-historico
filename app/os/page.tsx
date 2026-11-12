import Link from "next/link";
import ConfigTabela from "@/components/config-tabela";
import Zap from "@/components/zap";
import { getContexto } from "@/lib/contexto";
import { fmtData, hojeBR, moeda } from "@/lib/format";
import { COR_ATRASO, COR_OK, COR_PRIORIDADE, COR_STATUS_OS, corSituacao, ROTULO_PRIORIDADE, STATUS_OS } from "@/lib/os";
import { podeEditar, podeVer } from "@/lib/permissoes";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function excluirOS(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase.from("service_orders").delete().eq("id", String(fd.get("id")));
  if (error) redirect("/os?erro=" + encodeURIComponent(error.message));
  revalidatePath("/os");
  redirect("/os");
}


export default async function ListaOS({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { status, q, prazo, prioridade, situacao } = sp;
  const { eq, fatend, ftec, ftipo, forigem, ffilial, ftag, fobs, dpor, di, df, excluir, erro } = sp;
  const { supabase, perfil } = await getContexto();
  const editar = podeEditar(perfil?.role, (perfil as any)?.permissions, "os");

  const { data } = await supabase
    .from("service_orders")
    .select("id, number, status, priority, situacao, warranty, tags, defect, deadline, entry_at, closed_at, created_by, technician_id, tipo_os, origem, filial, observacoes, clients(name, phone, mobile), equipment(code, brand, model, serial_number)")
    .order("number", { ascending: false })
    .limit(500);
  const todas: any[] = data ?? [];
  const { data: pessoas } = await supabase.from("profiles").select("id, full_name");
  const nome = (id: string | null) => (pessoas ?? []).find((p: any) => p.id === id)?.full_name ?? "—";
  const hoje = hojeBR();
  const amanha = new Date(new Date(hoje + "T12:00:00").getTime() + 86400000).toISOString().slice(0, 10);
  const encerrada = (o: any) => ["concluido", "faturado", "finalizado", "cancelado"].includes(o.status);
  const abertas = todas.filter((o) => !encerrada(o));
  const faixaPrazo = (o: any) =>
    !o.deadline ? "sem" : o.deadline < hoje ? "vencidas" : o.deadline === hoje ? "hoje" : o.deadline === amanha ? "amanha" : "no_prazo";
  const nPrazo: Record<string, number> = { vencidas: 0, hoje: 0, amanha: 0, no_prazo: 0 };
  for (const o of abertas) if (faixaPrazo(o) in nPrazo) nPrazo[faixaPrazo(o)]++;
  const nPrio = (p: string[]) => abertas.filter((o) => p.includes(o.priority)).length;
  const situacoesUsadas = Array.from(new Set(abertas.map((o) => o.situacao).filter(Boolean))) as string[];

  const contagem: Record<string, number> = {};
  for (const o of todas) contagem[o.status] = (contagem[o.status] ?? 0) + 1;

  const termo = (q ?? "").trim().toLowerCase();
  const lista = todas.filter((o) => {
    if (status === "trabalhando") { if (!["entrada", "orcamento", "aberto", "andamento", "pausado"].includes(o.status)) return false; }
    else if (status && status !== "todas" && o.status !== status) return false;
    if (!status && ["faturado", "finalizado", "cancelado"].includes(o.status)) return false;
    if (prazo && (encerrada(o) || faixaPrazo(o) !== prazo)) return false;
    if (prioridade === "alta" && !["alta", "urgente"].includes(o.priority)) return false;
    if (prioridade && prioridade !== "alta" && o.priority !== prioridade) return false;
    if (situacao && o.situacao !== situacao) return false;
    if (fatend && o.created_by !== fatend) return false;
    if (ftec && o.technician_id !== ftec) return false;
    if (ftipo && o.tipo_os !== ftipo) return false;
    if (forigem && o.origem !== forigem) return false;
    if (ffilial && o.filial !== ffilial) return false;
    if (ftag && !(o.tags ?? []).includes(ftag)) return false;
    if (fobs && !String(o.observacoes ?? "").toLowerCase().includes(fobs.toLowerCase())) return false;
    if (eq && !`${o.equipment?.code ?? ""} ${o.equipment?.brand ?? ""} ${o.equipment?.model ?? ""} ${o.equipment?.serial_number ?? ""} ${o.defect ?? ""}`.toLowerCase().includes(eq.toLowerCase())) return false;
    if (di || df) {
      const d = String(dpor === "prazo" ? o.deadline : dpor === "fechamento" ? o.closed_at : o.entry_at ?? "").slice(0, 10);
      if (!d || (di && d < di) || (df && d > df)) return false;
    }
    if (!termo) return true;
    return [String(o.number), o.clients?.name, o.equipment?.code, o.equipment?.model, o.defect]
      .filter(Boolean)
      .some((t: string) => t.toLowerCase().includes(termo));
  });

  const uniq = (k: string) => Array.from(new Set(todas.map((o) => o[k]).filter(Boolean))) as string[];
  const todasTags = Array.from(new Set(todas.flatMap((o) => (o.tags ?? []) as string[])));
  const alvoExcluir = excluir ? todas.find((o) => o.id === excluir) : null;
  const verFin = podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro");
  const valores: Record<string, { prod: number; serv: number; desc: number }> = {};
  if (verFin && lista.length) {
    const ids = lista.map((o) => o.id);
    const pedacos: string[][] = [];
    for (let i = 0; i < ids.length; i += 80) pedacos.push(ids.slice(i, i + 80));
    const [its, fins, precos] = await Promise.all([
      Promise.all(pedacos.map((c) => supabase.from("service_order_items").select("id, order_id, kind, quantity").in("order_id", c))),
      Promise.all(pedacos.map((c) => supabase.from("order_finance").select("order_id, discount").in("order_id", c))),
      Promise.all(pedacos.map((c) => supabase.from("item_prices").select("item_id, unit_price, service_order_items!inner(order_id)").in("service_order_items.order_id", c))),
    ]);
    const pr: Record<string, number> = {};
    for (const r of precos.flatMap((x) => x.data ?? [])) pr[(r as any).item_id] = Number((r as any).unit_price);
    for (const i of its.flatMap((x) => x.data ?? []) as any[]) {
      const v = (valores[i.order_id] ??= { prod: 0, serv: 0, desc: 0 });
      const sub = Number(i.quantity) * (pr[i.id] ?? 0);
      if (i.kind === "peca") v.prod += sub; else v.serv += sub;
    }
    for (const f of fins.flatMap((x) => x.data ?? []) as any[]) (valores[f.order_id] ??= { prod: 0, serv: 0, desc: 0 }).desc = Number(f.discount ?? 0);
  }

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 14 }}>
        <h1 className="title">Ordens de Serviço</h1>
        {editar && (
          <Link className="btn primary" href="/os/nova">
            + Nova OS
          </Link>
        )}
      </div>

      <section className="card" style={{ marginBottom: 12 }}>
        <div className="muted" style={{ marginBottom: 6 }}>Prazo e prioridade (OS em aberto)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className={prazo === "vencidas" ? "btn primary" : "btn secondary"} href="/os?prazo=vencidas">Vencidas ({nPrazo.vencidas})</Link>
          <Link className={prazo === "hoje" ? "btn primary" : "btn secondary"} href="/os?prazo=hoje">Hoje ({nPrazo.hoje})</Link>
          <Link className={prazo === "amanha" ? "btn primary" : "btn secondary"} href="/os?prazo=amanha">Amanhã ({nPrazo.amanha})</Link>
          <Link className={prazo === "no_prazo" ? "btn primary" : "btn secondary"} href="/os?prazo=no_prazo">No prazo ({nPrazo.no_prazo})</Link>
          <Link className={prioridade === "alta" ? "btn primary" : "btn secondary"} href="/os?prioridade=alta">Prioridade alta ({nPrio(["alta", "urgente"])})</Link>
          <Link className={prioridade === "normal" ? "btn primary" : "btn secondary"} href="/os?prioridade=normal">Normal ({nPrio(["normal"])})</Link>
          <Link className={prioridade === "baixa" ? "btn primary" : "btn secondary"} href="/os?prioridade=baixa">Baixa ({nPrio(["baixa"])})</Link>
        </div>
        {!!situacoesUsadas.length && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {situacoesUsadas.map((sv) => (
              <Link key={sv} className={situacao === sv ? "btn primary" : "btn secondary"} href={`/os?situacao=${encodeURIComponent(sv)}`}>
                {sv} ({abertas.filter((o) => o.situacao === sv).length})
              </Link>
            ))}
          </div>
        )}
      </section>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <Link className={!status ? "btn primary" : "btn secondary"} href="/os">
          Em aberto
        </Link>
        {Object.entries(STATUS_OS).map(([v, n]) => (
          <Link key={v} className={status === v ? "btn primary" : "btn secondary"} href={`/os?status=${v}`}>
            {n} ({contagem[v] ?? 0})
          </Link>
        ))}
      </div>

      {erro && <div className="error" style={{ marginBottom: 12 }}>{erro}</div>}
      {alvoExcluir && editar && (
        <div className="card" style={{ marginBottom: 12, borderColor: "#dc2626" }}>
          <p style={{ marginTop: 0 }}>Excluir a OS <b>#{alvoExcluir.number}</b> ({alvoExcluir.clients?.name ?? "sem cliente"})? Isso não pode ser desfeito.</p>
          <form action={excluirOS} style={{ display: "flex", gap: 8 }}>
            <input type="hidden" name="id" value={alvoExcluir.id} />
            <button className="btn primary" style={{ background: "#dc2626" }}>Sim, excluir</button>
            <Link className="btn secondary" href="/os">Cancelar</Link>
          </form>
        </div>
      )}

      <details className="card" style={{ marginBottom: 12 }} open={!!(eq || fatend || ftec || ftipo || forigem || ffilial || ftag || fobs || di || df)}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>⚙ Filtros avançados</summary>
        <form className="grid g4" style={{ marginTop: 10 }}>
          {status && <input type="hidden" name="status" value={status} />}
          {q && <input type="hidden" name="q" value={q} />}
          <label className="field">Equipamento / defeito<input name="eq" defaultValue={eq ?? ""} placeholder="Nome, série, modelo, defeito" /></label>
          <label className="field">Observações<input name="fobs" defaultValue={fobs ?? ""} /></label>
          <label className="field">Atendente
            <select name="fatend" defaultValue={fatend ?? ""}><option value="">Todos</option>{(pessoas ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
          </label>
          <label className="field">Técnico
            <select name="ftec" defaultValue={ftec ?? ""}><option value="">Todos</option>{(pessoas ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
          </label>
          <label className="field">Tipo
            <select name="ftipo" defaultValue={ftipo ?? ""}><option value="">Todos</option>{uniq("tipo_os").map((v) => <option key={v}>{v}</option>)}</select>
          </label>
          <label className="field">Origem
            <select name="forigem" defaultValue={forigem ?? ""}><option value="">Todas</option>{uniq("origem").map((v) => <option key={v}>{v}</option>)}</select>
          </label>
          <label className="field">Filial
            <select name="ffilial" defaultValue={ffilial ?? ""}><option value="">Todas</option>{uniq("filial").map((v) => <option key={v}>{v}</option>)}</select>
          </label>
          <label className="field">Tag
            <select name="ftag" defaultValue={ftag ?? ""}><option value="">Todas</option>{todasTags.map((v) => <option key={v}>{v}</option>)}</select>
          </label>
          <label className="field">Filtrar data por
            <select name="dpor" defaultValue={dpor ?? "entrada"}><option value="entrada">Entrada</option><option value="prazo">Prazo</option><option value="fechamento">Fechamento</option></select>
          </label>
          <label className="field">Data inicial<input type="date" name="di" defaultValue={di ?? ""} /></label>
          <label className="field">Data final<input type="date" name="df" defaultValue={df ?? ""} /></label>
          <div style={{ alignSelf: "end", display: "flex", gap: 8 }}>
            <button className="btn primary">Aplicar</button>
            <Link className="btn secondary" href="/os">Limpar</Link>
          </div>
        </form>
      </details>

      <form className="card" style={{ marginBottom: 12, display: "flex", gap: 10 }}>
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q ?? ""} placeholder="Buscar por número, cliente, equipamento ou defeito" style={{ flex: 1 }} />
        <button className="btn secondary">Buscar</button>
      </form>

      <section className="card">
        <ConfigTabela chave="os" />
<table className="table">
          <thead>
            <tr>
              <th>OS</th>
              <th>Cliente / equipamento</th>
              <th>Status</th>
              <th>Atendente / técnico</th>
              <th>Prioridade</th>
              <th>Entrada</th>
              <th>Prazo</th>
              {verFin && <th>Produtos</th>}
              {verFin && <th>Serviços</th>}
              {verFin && <th>Desconto</th>}
              {verFin && <th>Valor</th>}
              <th>Tags</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((o) => {
              const atrasada = o.deadline && o.deadline < hoje && !encerrada(o);
              return (
                <tr key={o.id}>
                  <td>
                    <Link href={`/os/${o.id}`} style={{ color: "var(--link)", fontWeight: 800 }}>
                      #{o.number}
                    </Link>
                    {o.warranty && <div className="badge">Garantia</div>}
                  </td>
                  <td>
                    <div>{o.clients?.name ?? "—"}<Zap telefone={o.clients?.mobile || o.clients?.phone} mensagem={`Olá, ${o.clients?.name}! Sobre a sua OS #${o.number} na Infor Cartuchos:`} /></div>
                    <div className="muted">
                      {o.equipment ? `${o.equipment.code} · ${o.equipment.brand ?? ""} ${o.equipment.model ?? ""}` : "Sem equipamento"}
                    </div>
                  </td>
                  <td>
                    <span className="selo" style={{ background: COR_STATUS_OS[o.status] }}>{STATUS_OS[o.status]}</span>
                    {o.situacao && <div><span className="selo" style={{ background: corSituacao(o.situacao) }}>{o.situacao}</span></div>}
                  </td>
                  <td>
                    <div>{nome(o.created_by)}</div>
                    <div className="muted">{nome(o.technician_id)}</div>
                  </td>
                  <td><span className="selo" style={{ background: COR_PRIORIDADE[o.priority] }}>{ROTULO_PRIORIDADE[o.priority] ?? o.priority}</span></td>
                  <td>{fmtData(o.entry_at)}</td>
                  <td>
                    {o.deadline && !encerrada(o) && <div><span className="selo" style={{ background: atrasada ? COR_ATRASO : COR_OK }}>{atrasada ? "Vencido" : "No prazo"}</span></div>}
                    {fmtData(o.deadline)}
                  </td>
                  {verFin && <td>{moeda(valores[o.id]?.prod ?? 0)}</td>}
                  {verFin && <td>{moeda(valores[o.id]?.serv ?? 0)}</td>}
                  {verFin && <td>{moeda(valores[o.id]?.desc ?? 0)}</td>}
                  {verFin && <td><b>{moeda(Math.max((valores[o.id]?.prod ?? 0) + (valores[o.id]?.serv ?? 0) - (valores[o.id]?.desc ?? 0), 0))}</b></td>}
                  <td>{((o.tags ?? []) as string[]).map((tg) => <span key={tg} className="os-tag" style={{ marginRight: 4 }}>{tg}</span>)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link className="btn primary" href={`/os/${o.id}`} title="Editar">✎</Link>{" "}
                    <Link className="btn secondary" href={`/os/${o.id}/imprimir`} title="Imprimir">🖨</Link>{" "}
                    <details style={{ display: "inline-block", position: "relative" }}>
                      <summary className="btn secondary" style={{ listStyle: "none", cursor: "pointer" }} title="Mais ações">☰</summary>
                      <div className="card" style={{ position: "absolute", right: 0, zIndex: 20, minWidth: 170, padding: 6, display: "grid", gap: 4, textAlign: "left" }}>
                        <Link href={`/os/${o.id}`}>👁 Visualizar</Link>
                        <Link href={`/os/${o.id}?aba=itens`}>🧰 Produtos/Serviços</Link>
                        {editar && <Link href={`/os?excluir=${o.id}`} style={{ color: "#dc2626" }}>🗑 Excluir</Link>}
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })}
            {!lista.length && (
              <tr>
                <td colSpan={13} className="muted">
                  Nenhuma ordem de serviço aqui.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
