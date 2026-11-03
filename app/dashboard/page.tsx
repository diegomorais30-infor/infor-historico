import Link from "next/link";
import { getContexto } from "@/lib/contexto";
import { PERFIS, STATUS_EQUIPAMENTO, fmtData } from "@/lib/format";

export default async function Dashboard() {
  const { supabase, perfil } = await getContexto();

  const em30dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [{ count: eqCount }, { count: clCount }, { count: mtCount }, { data: recentes }, { data: preventivas }, { data: pecas }] =
    await Promise.all([
      supabase.from("equipment").select("*", { count: "exact", head: true }),
      supabase.from("clients").select("*", { count: "exact", head: true }),
      supabase.from("maintenance").select("*", { count: "exact", head: true }),
      supabase
        .from("equipment")
        .select("id,code,brand,model,status,clients(name)")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("equipment")
        .select("id,code,brand,model,next_preventive_date,clients(name)")
        .not("next_preventive_date", "is", null)
        .lte("next_preventive_date", em30dias)
        .order("next_preventive_date")
        .limit(5),
      supabase.from("parts").select("id,name,stock_quantity,minimum_stock").eq("active", true),
    ]);

  const empresa = (perfil as any)?.companies;
  const pecasBaixas = ((pecas as any[]) ?? []).filter((p) => Number(p.stock_quantity) <= Number(p.minimum_stock));
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="title">Início</h1>
          <p className="muted">
            {perfil?.full_name ? `Olá, ${perfil.full_name}.` : "Bem-vindo."} Perfil: {PERFIS[perfil?.role ?? ""] ?? "—"}
          </p>
        </div>
        <Link className="btn primary" href="/equipamentos/novo">
          + Novo equipamento
        </Link>
      </div>

      <div className="grid g4">
        <div className="card">
          <div className="muted">Equipamentos</div>
          <div className="stat">
            {eqCount ?? 0}
            {empresa?.max_equipment ? <span className="muted" style={{ fontSize: 16 }}> / {empresa.max_equipment}</span> : null}
          </div>
        </div>
        <div className="card">
          <div className="muted">Clientes</div>
          <div className="stat">{clCount ?? 0}</div>
        </div>
        <div className="card">
          <div className="muted">Manutenções</div>
          <div className="stat">{mtCount ?? 0}</div>
        </div>
        <div className="card">
          <div className="muted">Plano</div>
          <div className="stat" style={{ fontSize: 20 }}>
            {empresa?.plan === "trial" ? "Teste" : empresa?.plan === "interno" ? "Interno" : (empresa?.plan ?? "—")}
          </div>
          {empresa?.trial_ends_at && (
            <div className="muted" style={{ fontSize: 13 }}>
              até {new Date(empresa.trial_ends_at).toLocaleDateString("pt-BR")}
            </div>
          )}
        </div>
      </div>

      <div className="grid g2" style={{ marginTop: 18 }}>
        <section className="card">
          <h2>Preventivas nos próximos 30 dias</h2>
          <table className="table">
            <tbody>
              {((preventivas as any[]) ?? []).map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link href={`/equipamentos/${e.id}`} style={{ color: "var(--blue)", fontWeight: 800 }}>
                      {e.code}
                    </Link>
                    <div className="muted">
                      {e.brand} {e.model} · {e.clients?.name ?? "—"}
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span className={e.next_preventive_date < hoje ? "badge warn" : "badge"}>
                      {fmtData(e.next_preventive_date)}
                    </span>
                  </td>
                </tr>
              ))}
              {!((preventivas as any[]) ?? []).length && (
                <tr>
                  <td className="muted">Nenhuma preventiva marcada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2>Peças para repor</h2>
          <table className="table">
            <tbody>
              {pecasBaixas.slice(0, 5).map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td style={{ textAlign: "right" }}>
                    <span className="badge warn">
                      {p.stock_quantity} (mín. {p.minimum_stock})
                    </span>
                  </td>
                </tr>
              ))}
              {!pecasBaixas.length && (
                <tr>
                  <td className="muted">Estoque em dia.</td>
                </tr>
              )}
            </tbody>
          </table>
          <Link href="/pecas" className="muted">
            Ver todas as peças →
          </Link>
        </section>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Equipamentos recentes</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Equipamento</th>
              <th>Cliente</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {((recentes as any[]) ?? []).map((e) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/equipamentos/${e.id}`} style={{ color: "var(--blue)", fontWeight: 800 }}>
                    {e.code}
                  </Link>
                </td>
                <td>
                  {e.brand} {e.model}
                </td>
                <td>{e.clients?.name ?? "—"}</td>
                <td>
                  <span className="badge">{STATUS_EQUIPAMENTO[e.status] ?? e.status}</span>
                </td>
              </tr>
            ))}
            {!((recentes as any[]) ?? []).length && (
              <tr>
                <td colSpan={4} className="muted">
                  Nenhum equipamento cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
