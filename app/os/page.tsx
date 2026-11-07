import Link from "next/link";
import { getContexto } from "@/lib/contexto";
import { fmtData, hojeBR } from "@/lib/format";
import { COR_STATUS_OS, PRIORIDADE_OS, STATUS_OS } from "@/lib/os";
import { podeEditar } from "@/lib/permissoes";

export default async function ListaOS({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const editar = podeEditar(perfil?.role, (perfil as any)?.permissions, "os");

  const { data } = await supabase
    .from("service_orders")
    .select("id, number, status, priority, situacao, defect, deadline, entry_at, clients(name), equipment(code, brand, model)")
    .order("number", { ascending: false })
    .limit(500);
  const todas: any[] = data ?? [];

  const contagem: Record<string, number> = {};
  for (const o of todas) contagem[o.status] = (contagem[o.status] ?? 0) + 1;

  const termo = (q ?? "").trim().toLowerCase();
  const lista = todas.filter((o) => {
    if (status && o.status !== status) return false;
    if (!status && (o.status === "faturado" || o.status === "cancelado")) return false;
    if (!termo) return true;
    return [String(o.number), o.clients?.name, o.equipment?.code, o.equipment?.model, o.defect]
      .filter(Boolean)
      .some((t: string) => t.toLowerCase().includes(termo));
  });
  const hoje = hojeBR();

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
              <th>Prioridade</th>
              <th>Prazo</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((o) => {
              const atrasada = o.deadline && o.deadline < hoje && !["concluido", "faturado", "cancelado"].includes(o.status);
              return (
                <tr key={o.id}>
                  <td>
                    <Link href={`/os/${o.id}`} style={{ color: "var(--link)", fontWeight: 800 }}>
                      #{o.number}
                    </Link>
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
                <td colSpan={5} className="muted">
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
