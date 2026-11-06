import Link from "next/link";
import AvisosPush from "@/components/avisos-push";
import { getContexto } from "@/lib/contexto";
import { PERFIS, STATUS_EQUIPAMENTO, fmtData, hojeBR, moeda } from "@/lib/format";

export default async function Dashboard() {
  const { supabase, perfil } = await getContexto();

  // Datas no horário de Brasília
  const hoje = hojeBR();
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${hoje}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    return d.toISOString().slice(0, 10);
  });
  const inicio7 = `${dias[6]}T00:00:00-03:00`;
  const diaSP = (ts: string) => new Date(ts).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

  const em30dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    { count: eqCount },
    { count: clCount },
    { count: mtCount },
    { data: recentes },
    { data: preventivas },
    { data: pecas },
    { data: chamados7 },
    { data: abertos },
    { data: manut7 },
    { data: pecasUsadas },
    { data: pagas7 },
    { data: faturasAbertas },
  ] = await Promise.all([
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
      supabase.from("service_requests").select("created_at,resolved_at").or(`created_at.gte.${inicio7},resolved_at.gte.${inicio7}`),
      supabase.from("service_requests").select("status").in("status", ["open", "in_progress"]),
      supabase.from("maintenance").select("service_date").gte("service_date", dias[6]),
      supabase.from("maintenance_parts").select("quantity,created_at").gte("created_at", inicio7),
      supabase.from("invoices").select("total,paid_at").eq("status", "paid").gte("paid_at", inicio7),
      supabase.from("invoices").select("total,due_date").eq("status", "open"),
    ]);

  const gerente = (perfil as any)?.role === "admin" || (perfil as any)?.role === "manager";
  const empresa = (perfil as any)?.companies;
  const pecasBaixas = ((pecas as any[]) ?? []).filter((p) => Number(p.stock_quantity) <= Number(p.minimum_stock));

  // Métricas por dia (últimos 7 dias, hoje primeiro)
  const porDia = dias.map((dia) => ({
    dia,
    novos: ((chamados7 as any[]) ?? []).filter((c) => c.created_at && diaSP(c.created_at) === dia).length,
    concluidos: ((chamados7 as any[]) ?? []).filter((c) => c.resolved_at && diaSP(c.resolved_at) === dia).length,
    manutencoes: ((manut7 as any[]) ?? []).filter((m) => m.service_date === dia).length,
    pecas: ((pecasUsadas as any[]) ?? [])
      .filter((x) => diaSP(x.created_at) === dia)
      .reduce((t, x) => t + Number(x.quantity), 0),
    recebido: ((pagas7 as any[]) ?? [])
      .filter((f) => f.paid_at && diaSP(f.paid_at) === dia)
      .reduce((t, f) => t + Number(f.total), 0),
  }));
  const h = porDia[0];
  const emAberto = ((abertos as any[]) ?? []).length;
  const emAtendimento = ((abertos as any[]) ?? []).filter((c) => c.status === "in_progress").length;
  const vencidas = ((faturasAbertas as any[]) ?? []).filter((f) => f.due_date < hoje);
  const venceHoje = ((faturasAbertas as any[]) ?? []).filter((f) => f.due_date === hoje);
  const somaFat = (l: any[]) => l.reduce((t, f) => t + Number(f.total), 0);

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="title">Início</h1>
          <p className="muted">
            {perfil?.full_name ? `Olá, ${perfil.full_name}.` : "Bem-vindo."} Perfil: {PERFIS[perfil?.role ?? ""] ?? "—"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn secondary" href="/ler-qr">
            Ler QR Code
          </Link>
          <Link className="btn primary" href="/equipamentos/novo">
            + Novo equipamento
          </Link>
        </div>
      </div>

      <AvisosPush />

      <h2 style={{ margin: "0 0 10px" }}>Hoje · {fmtData(hoje)}</h2>
      <div className="grid g4">
        <Link href="/chamados" className="card" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="muted">Chamados novos hoje</div>
          <div className="stat">{h.novos}</div>
        </Link>
        <Link href="/chamados" className="card" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="muted">Chamados pendentes</div>
          <div className="stat">{emAberto}</div>
          <div className="muted" style={{ fontSize: 13 }}>{emAtendimento} em atendimento</div>
        </Link>
        <div className="card">
          <div className="muted">Chamados concluídos hoje</div>
          <div className="stat">{h.concluidos}</div>
        </div>
        <div className="card">
          <div className="muted">Manutenções hoje</div>
          <div className="stat">{h.manutencoes}</div>
          <div className="muted" style={{ fontSize: 13 }}>{h.pecas} peça(s) usada(s)</div>
        </div>
        {gerente && (<>
        <div className="card">
          <div className="muted">Recebido hoje</div>
          <div className="stat" style={{ fontSize: 24 }}>{moeda(h.recebido)}</div>
        </div>
        <Link href="/contratos" className="card" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="muted">Faturas vencem hoje</div>
          <div className="stat">{venceHoje.length}</div>
          <div className="muted" style={{ fontSize: 13 }}>{moeda(somaFat(venceHoje))}</div>
        </Link>
        <Link href="/contratos" className="card" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="muted">Faturas vencidas</div>
          <div className="stat" style={{ color: vencidas.length ? "#ffb4b4" : undefined }}>{vencidas.length}</div>
          <div className="muted" style={{ fontSize: 13 }}>{moeda(somaFat(vencidas))}</div>
        </Link>
        </>)}
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Últimos 7 dias</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Dia</th>
              <th>Chamados novos</th>
              <th>Concluídos</th>
              <th>Manutenções</th>
              <th>Peças</th>
              <th>Recebido</th>
            </tr>
          </thead>
          <tbody>
            {porDia.map((d, i) => (
              <tr key={d.dia}>
                <td>
                  {fmtData(d.dia)} {i === 0 && <span className="badge">hoje</span>}
                </td>
                <td>{d.novos}</td>
                <td>{d.concluidos}</td>
                <td>{d.manutencoes}</td>
                <td>{d.pecas}</td>
                <td>{moeda(d.recebido)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2 style={{ margin: "22px 0 10px" }}>Visão geral</h2>
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
                    <Link href={`/equipamentos/${e.id}`} style={{ color: "var(--link)", fontWeight: 800 }}>
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
                  <Link href={`/equipamentos/${e.id}`} style={{ color: "var(--link)", fontWeight: 800 }}>
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
