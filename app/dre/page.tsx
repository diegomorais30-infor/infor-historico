import Link from "next/link";
import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { podeVer } from "@/lib/permissoes";
import { moeda } from "@/lib/format";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default async function DRE({ searchParams }: { searchParams: Promise<{ ano?: string; base?: string }> }) {
  const { ano: anoParam, base } = await searchParams;
  const { supabase, perfil } = await getContexto();
  if (!podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro")) redirect("/dashboard");
  const ano = /^\d{4}$/.test(anoParam ?? "") ? Number(anoParam) : new Date().getFullYear();
  const caixa = base === "caixa"; // caixa = data do pagamento; competência = data de competência
  const campo = caixa ? "paid_at" : "competence";

  const linhas: any[] = [];
  for (let de = 0; ; de += 1000) {
    const { data } = await supabase.from("finance_entries").select("kind, category, amount, competence, paid_at")
      .gte(campo, `${ano}-01-01`).lte(campo, `${ano}-12-31`).order("id").range(de, de + 999);
    linhas.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  type Linha = { nome: string; meses: number[] };
  const grupos: Record<"receita" | "despesa", Map<string, Linha>> = { receita: new Map(), despesa: new Map() };
  for (const l of linhas) {
    const mes = Number(String(l[campo]).slice(5, 7)) - 1;
    const nome = l.category || "Sem categoria";
    const g = grupos[l.kind as "receita" | "despesa"];
    if (!g.has(nome)) g.set(nome, { nome, meses: Array(12).fill(0) });
    g.get(nome)!.meses[mes] += Number(l.amount);
  }
  const lista = (k: "receita" | "despesa") => [...grupos[k].values()].sort((a, b) => b.meses.reduce((s, x) => s + x, 0) - a.meses.reduce((s, x) => s + x, 0));
  const soma = (ls: Linha[]) => Array.from({ length: 12 }, (_, i) => ls.reduce((s, l) => s + l.meses[i], 0));
  const rec = lista("receita"), des = lista("despesa");
  const tr = soma(rec), td = soma(des), res = tr.map((v, i) => v - td[i]);
  const tot = (a: number[]) => a.reduce((s, x) => s + x, 0);
  const cel = (v: number, k?: number) => <td key={k} style={{ textAlign: "right", whiteSpace: "nowrap" }}>{v ? moeda(v) : "—"}</td>;
  const bloco = (titulo: string, ls: Linha[], t: number[]) => (
    <>
      <tr><th colSpan={14} style={{ background: "var(--soft)" }}>{titulo}</th></tr>
      {ls.map((l) => (<tr key={l.nome}><td>{l.nome}</td>{l.meses.map((v, i) => cel(v, i))}{cel(tot(l.meses))}</tr>))}
      <tr style={{ fontWeight: 800 }}><td>Total</td>{t.map((v, i) => cel(v, i))}{cel(tot(t))}</tr>
    </>
  );
  return (
    <main className="wrap" style={{ maxWidth: 1500 }}>
      <h1 className="title">DRE — {ano}</h1>
      <p className="muted">Resultado por categoria, base {caixa ? "caixa (data do pagamento)" : "competência"}.</p>
      <form className="card" style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
        <label>Ano<input name="ano" type="number" defaultValue={ano} style={{ width: 90 }} /></label>
        <label>Base<select name="base" defaultValue={caixa ? "caixa" : "competencia"}><option value="competencia">Competência</option><option value="caixa">Caixa</option></select></label>
        <button className="btn primary">Ver</button>
        <Link className="btn secondary" href="/dre">Limpar</Link>
      </form>
      <div className="card" style={{ overflowX: "auto", marginTop: 12 }}>
        <table>
          <thead><tr><th>Categoria</th>{MESES.map((m) => <th key={m} style={{ textAlign: "right" }}>{m}</th>)}<th style={{ textAlign: "right" }}>Ano</th></tr></thead>
          <tbody>
            {bloco("Receitas", rec, tr)}
            {bloco("Despesas", des, td)}
            <tr style={{ fontWeight: 800, background: "var(--soft)" }}><td>Resultado</td>{res.map((v, i) => cel(v, i))}{cel(tot(res))}</tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
