import Link from "next/link";
import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { hojeBR, moeda } from "@/lib/format";
import { podeVer } from "@/lib/permissoes";

const NOMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default async function Fluxo() {
  const { supabase, perfil } = await getContexto();
  if (!podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro")) redirect("/dashboard");
  const hoje = hojeBR();
  const [a, m] = hoje.split("-").map(Number);
  const meses: string[] = [];
  for (let i = -5; i <= 6; i++) {
    const d = new Date(a, m - 1 + i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const ini = `${meses[0]}-01`;
  const d2 = new Date(a, m - 1 + 7, 1);
  const fim = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, "0")}-01`;
  const { data } = await supabase.from("finance_entries").select("kind, amount, due_date, paid_at").gte("due_date", ini).lt("due_date", fim);
  const linhas = meses.map((mm) => {
    const doMes = (data ?? []).filter((e: any) => String(e.due_date).startsWith(mm));
    const s = (k: string) => doMes.filter((e: any) => e.kind === k).reduce((t: number, e: any) => t + Number(e.amount), 0);
    const rec = s("receita");
    const desp = s("despesa");
    return { mm, rec, desp, saldo: rec - desp };
  });
  let acumulado = 0;
  const max = Math.max(1, ...linhas.map((l) => Math.max(l.rec, l.desp)));

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 12 }}>
        <h1 className="title">Fluxo de caixa</h1>
        <Link className="btn secondary" href="/financeiro">Voltar</Link>
      </div>
      <p className="muted">Receitas e despesas previstas por mês de vencimento (pagas e pendentes), 5 meses atrás até 6 à frente.</p>
      <section className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Mês</th>
              <th>Receitas</th>
              <th>Despesas</th>
              <th>Resultado</th>
              <th>Acumulado</th>
              <th style={{ width: "30%" }}></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              acumulado += l.saldo;
              const [aa, mm] = l.mm.split("-").map(Number);
              return (
                <tr key={l.mm} style={l.mm === hoje.slice(0, 7) ? { background: "var(--soft)" } : undefined}>
                  <td>
                    <Link href={`/financeiro?mes=${l.mm}`} style={{ color: "var(--link)" }}>
                      {NOMES[mm - 1]}/{aa}
                    </Link>
                  </td>
                  <td style={{ color: "#3fb583" }}>{moeda(l.rec)}</td>
                  <td style={{ color: "#e5484d" }}>{moeda(l.desp)}</td>
                  <td style={{ fontWeight: 700, color: l.saldo >= 0 ? "#3fb583" : "#e5484d" }}>{moeda(l.saldo)}</td>
                  <td>{moeda(acumulado)}</td>
                  <td>
                    <div style={{ height: 8, background: "#3fb583", width: `${(l.rec / max) * 100}%`, borderRadius: 4, marginBottom: 3 }} />
                    <div style={{ height: 8, background: "#e5484d", width: `${(l.desp / max) * 100}%`, borderRadius: 4 }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
