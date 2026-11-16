import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getContexto } from "@/lib/contexto";
import { podeEditar } from "@/lib/permissoes";
import { STATUS_CONTRATO, moeda } from "@/lib/format";

async function salvar(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const fee = Number(String(formData.get("monthly_fee") || "0").replace(/\./g, "").replace(",", "."));
  const q = String(formData.get("q") || "");
  const f = String(formData.get("f") || "");
  const volta = `/contratos/gerenciar?${new URLSearchParams({ q, f }).toString()}`;
  if (!["active", "suspended", "ended"].includes(status) || !Number.isFinite(fee) || fee < 0) redirect(volta + "&erro=" + encodeURIComponent("Valor ou situação inválidos."));
  const { error } = await supabase.from("contracts").update({ status, monthly_fee: fee }).eq("id", id);
  if (error) redirect(volta + "&erro=" + encodeURIComponent(error.message));
  revalidatePath("/contratos");
  revalidatePath("/contratos/gerenciar");
  redirect(volta + "&ok=" + encodeURIComponent(String(formData.get("code") || "")));
}

export default async function Gerenciar({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const { supabase, perfil } = await getContexto();
  const pode = podeEditar(perfil?.role, (perfil as any)?.permissions, "contratos");
  const { data } = await supabase.from("contracts").select("id, code, status, monthly_fee, clients(name), equipment(count)").order("code");
  const todos: any[] = data ?? [];
  const q = (sp.q ?? "").trim().toLowerCase();
  const f = sp.f ?? "";
  const lista = todos.filter((c) => (!f || c.status === f) && (!q || `${c.code} ${c.clients?.name ?? ""}`.toLowerCase().includes(q)));
  const ativos = todos.filter((c) => c.status === "active");
  const receita = ativos.reduce((t, c) => t + Number(c.monthly_fee), 0);

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 14 }}>
        <div>
          <h1 className="title">Gerenciar contratos</h1>
          <p className="muted">Ative, suspenda ou encerre contratos e ajuste o valor da locação.</p>
        </div>
        <Link className="btn secondary" href="/contratos">← Contratos</Link>
      </div>

      {sp.ok && <div className="card" style={{ borderColor: "#1f8f5a", marginBottom: 12 }}>Contrato {sp.ok} atualizado.</div>}
      {sp.erro && <div className="card" style={{ borderColor: "#e5484d", marginBottom: 12 }}>{sp.erro}</div>}

      <div className="grid g3">
        <div className="card"><div className="muted">Ativos</div><div className="stat">{ativos.length}</div></div>
        <div className="card"><div className="muted">Receita mensal dos ativos</div><div className="stat">{moeda(receita)}</div></div>
        <div className="card"><div className="muted">Suspensos / encerrados</div><div className="stat">{todos.length - ativos.length}</div></div>
      </div>

      <section className="card" style={{ marginTop: 14 }}>
        <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar cliente ou contrato" style={{ flex: "1 1 220px" }} />
          <select name="f" defaultValue={f}>
            <option value="">Todas as situações</option>
            {Object.entries(STATUS_CONTRATO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn secondary">Filtrar</button>
        </form>
        <table className="table">
          <thead><tr><th>Contrato</th><th>Cliente</th><th>Imp.</th><th>Valor da locação (R$)</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/contratos/${c.id}`} style={{ color: "var(--link)", fontWeight: 800 }}>{c.code}</Link></td>
                <td>{c.clients?.name ?? "—"}</td>
                <td>{c.equipment?.[0]?.count ?? 0}</td>
                {pode ? (
                  <>
                    <td colSpan={3}>
                      <form action={salvar} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="code" value={c.code} />
                        <input type="hidden" name="q" value={sp.q ?? ""} />
                        <input type="hidden" name="f" value={f} />
                        <input name="monthly_fee" inputMode="decimal" defaultValue={Number(c.monthly_fee).toFixed(2).replace(".", ",")} style={{ width: 120 }} />
                        <select name="status" defaultValue={c.status}>
                          {Object.entries(STATUS_CONTRATO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <button className="btn primary">Salvar</button>
                      </form>
                    </td>
                  </>
                ) : (
                  <><td>{moeda(c.monthly_fee)}</td><td>{STATUS_CONTRATO[c.status]}</td><td></td></>
                )}
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={6} className="muted">Nenhum contrato encontrado.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
