import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { podeEditar } from "@/lib/permissoes";
import SelecionarTodos from "./selecionar";

// Remove só o número de patrimônio dos equipamentos marcados (o equipamento, o histórico e o QR continuam).
async function limparPatrimonio(formData: FormData) {
  "use server";
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const volta = String(formData.get("volta") || "/equipamentos");
  if (!ids.length) redirect(volta + (volta.includes("?") ? "&" : "?") + "aviso=" + encodeURIComponent("Marque ao menos um equipamento."));
  const supabase = await createClient();
  const { error } = await supabase.from("equipment").update({ asset_tag: null }).in("id", ids);
  revalidatePath("/equipamentos");
  redirect(volta + (volta.includes("?") ? "&" : "?") + "aviso=" + encodeURIComponent(error ? error.message : `Patrimônio removido de ${ids.length} equipamento(s).`));
}

export default async function Equipamentos({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; aviso?: string }> }) {
  const { q, f, aviso } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const editar = podeEditar(perfil?.role, perfil?.permissions, "equipamentos");
  const { data } = await supabase
    .from("equipment")
    .select("id, code, equipment_number, asset_tag, equipment_type, brand, model, serial_number, location, status, color, contract_id, clients(name)")
    .order("equipment_number", { ascending: false })
    .limit(2000);
  const t = (q ?? "").trim().toLowerCase();
  const filtro = f ?? "todos";
  const lista = (data ?? []).filter((e: any) =>
    filtro === "avulso" ? !e.contract_id : filtro === "contrato" ? !!e.contract_id : filtro === "com" ? !!e.asset_tag : filtro === "sem" ? !e.asset_tag : filtro === "avulso-com" ? !e.contract_id && !!e.asset_tag : true
  ).filter(
    (e: any) => !t || `${e.asset_tag ?? ""} ${e.brand ?? ""} ${e.model ?? ""} ${e.serial_number ?? ""} ${e.clients?.name ?? ""} ${e.equipment_type ?? ""}`.toLowerCase().includes(t)
  );
  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="title">Equipamentos</h1>
          <p className="muted">{lista.length} equipamentos. O patrimônio é o número da etiqueta e também o do QR code.</p>
        </div>
        <span style={{ display: "flex", gap: 8 }}>
          <Link className="btn secondary" href="/equipamentos/etiquetas">Imprimir QR / etiquetas</Link>
          <Link className="btn primary" href="/equipamentos/novo">+ Novo equipamento</Link>
        </span>
      </div>
      {aviso && <p className="card" style={{ marginBottom: 14 }}>{aviso}</p>}
      <form className="card" style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input name="q" defaultValue={q} placeholder="Buscar patrimônio, modelo, série, cliente ou tipo" style={{ flex: 1, minWidth: 200 }} />
        <select name="f" defaultValue={filtro}>
          <option value="todos">Todos</option>
          <option value="contrato">Com contrato</option>
          <option value="avulso">Avulsos (sem contrato)</option>
          <option value="avulso-com">Avulsos com patrimônio</option>
          <option value="com">Com patrimônio</option>
          <option value="sem">Sem patrimônio</option>
        </select>
        <button className="btn secondary">Filtrar</button>
      </form>
      <form action={limparPatrimonio}>
      <input type="hidden" name="volta" value={`/equipamentos?f=${filtro}${q ? "&q=" + encodeURIComponent(q) : ""}`} />
      {editar && (
        <p className="muted" style={{ margin: "0 0 10px" }}>
          Clientes avulsos não têm patrimônio próprio. Marque os equipamentos e remova o número:{" "}
          <button className="btn secondary" type="submit">Remover patrimônio dos marcados</button>
        </p>
      )}
      <section className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>{editar && <th><SelecionarTodos /></th>}<th>Patrimônio</th><th>Equipamento</th><th>Cliente</th><th>Nº série</th><th>Local</th><th>Contrato</th><th>Status</th></tr>
          </thead>
          <tbody>
            {lista.map((e: any) => (
              <tr key={e.id}>
                {editar && <td><input type="checkbox" name="ids" value={e.id} /></td>}
                <td>
                  <Link href={`/equipamentos/${e.id}`} style={{ color: "var(--link)", fontWeight: 800 }}>
                    {e.asset_tag ?? e.code ?? `#${e.equipment_number}`}
                  </Link>
                </td>
                <td>{[e.equipment_type, e.brand, e.model].filter(Boolean).join(" ") || "—"}{e.color ? <div className="muted">{e.color}</div> : null}</td>
                <td>{e.clients?.name ?? "—"}</td>
                <td>{e.serial_number ?? "—"}</td>
                <td>{e.location ?? "—"}</td>
                <td>{e.contract_id ? "Contrato" : "Avulso"}</td>
                <td><span className="badge">{e.status}</span></td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={8} className="muted">Nenhum equipamento encontrado.</td></tr>}
          </tbody>
        </table>
      </section>
      </form>
    </main>
  );
}
