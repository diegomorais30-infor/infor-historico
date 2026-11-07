import { podeEditar } from "@/lib/permissoes";
import Link from "next/link";
import { getContexto } from "@/lib/contexto";
import { STATUS_CONTRATO, fmtData, hojeBR, moeda } from "@/lib/format";

export default async function Contratos() {
  const { supabase, perfil } = await getContexto();
  const { data } = await supabase
    .from("contracts")
    .select("*, clients(name), equipment(count)")
    .order("created_at", { ascending: false });
  const contratos: any[] = data ?? [];

  const hoje = hojeBR();
  const em90 = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ativos = contratos.filter((c) => c.status === "active");
  const receita = ativos.reduce((soma, c) => soma + Number(c.monthly_fee), 0);
  const vencendo = ativos.filter((c) => c.end_date && c.end_date <= em90).length;
  const reajuste = ativos.filter((c) => c.next_adjustment_date && c.next_adjustment_date <= hoje).length;
  const gerente = podeEditar(perfil?.role, (perfil as any)?.permissions, "contratos");

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="title">Contratos</h1>
          <p className="muted">Locação com mensalidade, franquia de páginas e excedente.</p>
        </div>
        {gerente && (
          <Link className="btn primary" href="/contratos/novo">
            + Novo contrato
          </Link>
        )}
      </div>

      <div className="grid g4">
        <div className="card">
          <div className="muted">Receita mensal</div>
          <div className="stat">{moeda(receita)}</div>
        </div>
        <div className="card">
          <div className="muted">Contratos ativos</div>
          <div className="stat">{ativos.length}</div>
        </div>
        <div className="card">
          <div className="muted">Vencendo em 90 dias</div>
          <div className="stat">{vencendo}</div>
        </div>
        <div className="card">
          <div className="muted">Reajuste pendente</div>
          <div className="stat">{reajuste}</div>
        </div>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Contrato</th>
              <th>Cliente</th>
              <th>Impressoras</th>
              <th>Mensalidade</th>
              <th>Franquia P&amp;B / Cor</th>
              <th>Vigência até</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {contratos.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/contratos/${c.id}`} style={{ color: "var(--link)", fontWeight: 800 }}>
                    {c.code}
                  </Link>
                </td>
                <td>{c.clients?.name ?? "—"}</td>
                <td>{c.equipment?.[0]?.count ?? 0}</td>
                <td>{moeda(c.monthly_fee)}</td>
                <td>
                  {c.pages_included_bw} / {c.pages_included_color}
                </td>
                <td>{fmtData(c.end_date)}</td>
                <td>
                  <span className={c.status === "active" ? "badge" : "badge warn"}>{STATUS_CONTRATO[c.status]}</span>
                </td>
              </tr>
            ))}
            {!contratos.length && (
              <tr>
                <td colSpan={7} className="muted">
                  Nenhum contrato cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
