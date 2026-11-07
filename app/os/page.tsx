import Link from "next/link";
import { getContexto } from "@/lib/contexto";
import { fmtData, hojeBR } from "@/lib/format";
import { COR_STATUS_OS, PRIORIDADE_OS, STATUS_OS } from "@/lib/os";
import { podeEditar } from "@/lib/permissoes";

export default async function ListaOS({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; prazo?: string; prioridade?: string; situacao?: string }> }) {
  const { status, q, prazo, prioridade, situacao } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const editar = podeEditar(perfil?.role, (perfil as any)?.permissions, "os");

  const { data } = await supabase
    .from("service_orders")
    .select("id, number, status, priority, situacao, warranty, defect, deadline, entry_at, created_by, technician_id, clients(name), equipment(code, brand, model)")
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
    if (status && o.status !== status) return false;
    if (!status && ["faturado", "finalizado", "cancelado"].includes(o.status)) return false;
    if (prazo && (encerrada(o) || faixaPrazo(o) !== prazo)) return false;
    if (prioridade === "alta" && !["alta", "urgente"].includes(o.priority)) return false;
    if (prioridade && prioridade !== "alta" && o.priority !== prioridade) return false;
    if (situacao && o.situacao !== situacao) return false;
    if (!termo) return true;
    return [String(o.number), o.clients?.name, o.equipment?.code, o.equipment?.model, o.defect]
      .filter(Boolean)
      .some((t: string) => t.toLowerCase().includes(termo));
  });

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 14 }}>
        <h1 className="title">Ordens de serviço</h1>
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

      <form className="card" style={{ marginBottom: 12, display: "flex", gap: 10 }}>
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q ?? ""} placeholder="Buscar por número, cliente, equipamento ou defeito" style={{ flex: 1 }} />
        <button className="btn secondary">Buscar</button>
      </form>

      <section className="card">
        <table className="table">
          <thead>
            <tr>
              <th>OS</th>
              <th>Cliente / equipamento</th>
              <th>Status</th>
              <th>Atendente / técnico</th>
              <th>Prioridade</th>
              <th>Prazo</th>
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
                    <div>{o.clients?.name ?? "—"}</div>
                    <div className="muted">
                      {o.equipment ? `${o.equipment.code} · ${o.equipment.brand ?? ""} ${o.equipment.model ?? ""}` : "Sem equipamento"}
                    </div>
                  </td>
                  <td>
                    <span style={{ color: COR_STATUS_OS[o.status], fontWeight: 700 }}>{STATUS_OS[o.status]}</span>
                    {o.situacao && <div className="muted">{o.situacao}</div>}
                  </td>
                  <td>
                    <div>{nome(o.created_by)}</div>
                    <div className="muted">{nome(o.technician_id)}</div>
                  </td>
                  <td className={o.priority === "urgente" || o.priority === "alta" ? "prio-Alta" : ""}>{PRIORIDADE_OS[o.priority]}</td>
                  <td style={atrasada ? { color: "#ffb4b4", fontWeight: 700 } : undefined}>
                    {fmtData(o.deadline)}
                    {atrasada && <div style={{ fontSize: 12 }}>atrasada</div>}
                  </td>
                </tr>
              );
            })}
            {!lista.length && (
              <tr>
                <td colSpan={6} className="muted">
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
