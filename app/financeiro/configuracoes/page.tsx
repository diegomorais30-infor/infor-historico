import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { moeda } from "@/lib/format";
import { tudo } from "@/lib/paginar";
import { podeEditar, podeVer } from "@/lib/permissoes";

async function renomear(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const de = String(fd.get("de") || "");
  const para = String(fd.get("para") || "").trim();
  if (!de || !para || de === para) redirect("/financeiro/configuracoes?aba=categorias");
  const { error } = await supabase.from("finance_entries").update({ category: para }).eq("category", de);
  if (error) redirect("/financeiro/configuracoes?aba=categorias&erro=" + encodeURIComponent(error.message));
  revalidatePath("/financeiro/configuracoes");
  redirect("/financeiro/configuracoes?aba=categorias&ok=1");
}

const OPCOES: Record<string, { titulo: string; extra: string }> = {
  convenio: { titulo: "Convênios", extra: "Desconto / observação" },
  bandeira: { titulo: "Bandeiras", extra: "Observação" },
  cartao: { titulo: "Cartões de crédito", extra: "Bandeira / final / vencimento" },
};

async function adicionarOpcao(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const kind = String(fd.get("kind"));
  const name = String(fd.get("name") || "").trim();
  if (OPCOES[kind] && name) await supabase.from("finance_options").insert({ kind, name, extra: String(fd.get("extra") || "").trim() || null });
  revalidatePath("/financeiro/configuracoes");
  redirect(`/financeiro/configuracoes?aba=${kind}`);
}

async function removerOpcao(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const kind = String(fd.get("kind"));
  await supabase.from("finance_options").delete().eq("id", String(fd.get("id")));
  revalidatePath("/financeiro/configuracoes");
  redirect(`/financeiro/configuracoes?aba=${kind}`);
}

export default async function ConfigFinanceiro({ searchParams }: { searchParams: Promise<{ aba?: string; erro?: string; ok?: string }> }) {
  const { aba: a, erro, ok } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const perms = (perfil as any)?.permissions;
  if (!podeVer(perfil?.role, perms, "financeiro")) redirect("/dashboard");
  const editar = podeEditar(perfil?.role, perms, "financeiro");
  const aba = a === "categorias" ? "categorias" : a && OPCOES[a] ? a : "contas";
  const { data: opcoes } = await supabase.from("finance_options").select("id, kind, name, extra").order("name");
  const nOpc = (k: string) => (opcoes ?? []).filter((o: any) => o.kind === k).length;
  const linhas = await tudo(() => supabase.from("finance_entries").select("kind, category, amount, paid_at, id").order("id"));
  const pagas = linhas.filter((l: any) => l.paid_at);
  const saldo = pagas.reduce((s: number, l: any) => s + (l.kind === "receita" ? 1 : -1) * Number(l.amount), 0);
  const cats = new Map<string, { n: number; receita: number; despesa: number }>();
  for (const l of linhas as any[]) {
    const k = l.category || "(sem categoria)";
    const c = cats.get(k) ?? { n: 0, receita: 0, despesa: 0 };
    c.n++;
    if (l.kind === "receita") c.receita += Number(l.amount); else c.despesa += Number(l.amount);
    cats.set(k, c);
  }
  const lista = Array.from(cats.entries()).sort((x, y) => y[1].n - x[1].n);

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 12 }}>
        <div><h1 className="title">Configurações do Financeiro</h1><div className="muted">Contas e categorias usadas nas faturas</div></div>
        <Link className="btn secondary" href="/financeiro">← Faturas</Link>
      </div>
      <nav className="os-abas">
        <Link href="/financeiro/configuracoes" className={aba === "contas" ? "ativa" : ""}>Contas <span className="os-cont">1</span></Link>
        <Link href="/financeiro/configuracoes?aba=categorias" className={aba === "categorias" ? "ativa" : ""}>Categorias <span className="os-cont">{lista.length}</span></Link>
        {Object.entries(OPCOES).map(([k, o]) => (
          <Link key={k} href={`/financeiro/configuracoes?aba=${k}`} className={aba === k ? "ativa" : ""}>{o.titulo} <span className="os-cont">{nOpc(k)}</span></Link>
        ))}
      </nav>
      <section className="card os-painel" style={{ overflowX: "auto" }}>
        {erro && <div className="error" style={{ marginBottom: 10 }}>{erro}</div>}
        {ok && <div className="os-ok">Salvo.</div>}
        {aba === "contas" ? (
          <table className="table">
            <thead><tr><th>#</th><th>Conta</th><th>Saldo atual</th><th>Situação</th></tr></thead>
            <tbody><tr><td>1</td><td><b>Conta principal</b></td><td><b style={{ color: saldo >= 0 ? "#16a34a" : "#dc2626" }}>{moeda(saldo)}</b></td><td><span className="badge">Padrão</span> <span className="badge" style={{ background: "#dcfce7" }}>Ativa</span></td></tr></tbody>
          </table>
        ) : OPCOES[aba] ? (
          <>
            {editar && (
              <form action={adicionarOpcao} className="grid g3" style={{ marginBottom: 12 }}>
                <input type="hidden" name="kind" value={aba} />
                <label className="field">Nome<input name="name" required /></label>
                <label className="field">{OPCOES[aba].extra}<input name="extra" /></label>
                <div style={{ alignSelf: "end" }}><button className="btn primary">Adicionar</button></div>
              </form>
            )}
            <table className="table">
              <thead><tr><th>Nome</th><th>{OPCOES[aba].extra}</th>{editar && <th></th>}</tr></thead>
              <tbody>
                {(opcoes ?? []).filter((o: any) => o.kind === aba).map((o: any) => (
                  <tr key={o.id}>
                    <td><b>{o.name}</b></td><td>{o.extra ?? ""}</td>
                    {editar && <td><form action={removerOpcao}><input type="hidden" name="kind" value={aba} /><input type="hidden" name="id" value={o.id} /><button className="btn secondary">Remover</button></form></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {!nOpc(aba) && <p className="muted">Nenhum registro.</p>}
          </>
        ) : (
          <table className="table">
            <thead><tr><th>Categoria</th><th>Lançamentos</th><th>Receitas</th><th>Despesas</th>{editar && <th>Renomear</th>}</tr></thead>
            <tbody>
              {lista.map(([nome, c]) => (
                <tr key={nome}>
                  <td><b>{nome}</b></td><td>{c.n}</td><td>{moeda(c.receita)}</td><td>{moeda(c.despesa)}</td>
                  {editar && (
                    <td>{nome !== "(sem categoria)" && (
                      <form action={renomear} style={{ display: "flex", gap: 6 }}>
                        <input type="hidden" name="de" value={nome} />
                        <input name="para" placeholder="Novo nome" style={{ width: 160 }} />
                        <button className="btn secondary">Renomear</button>
                      </form>
                    )}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
