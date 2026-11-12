import Link from "next/link";
import ConfigTabela from "@/components/config-tabela";
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

// Marca os equipamentos selecionados como Contrato ou Avulso (não apaga nada; o histórico de manutenção é mantido).
async function marcarVinculo(formData: FormData) {
  "use server";
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const vinculo = String(formData.get("vinculo")) === "contrato" ? "contrato" : "avulso";
  const volta = String(formData.get("volta") || "/equipamentos");
  const msg = (m: string) => redirect(volta + (volta.includes("?") ? "&" : "?") + "aviso=" + encodeURIComponent(m));
  if (!ids.length) msg("Marque ao menos um equipamento.");
  const supabase = await createClient();
  const { error } = await supabase.from("equipment").update({ vinculo }).in("id", ids);
  revalidatePath("/equipamentos");
  msg(error ? error.message : `${ids.length} equipamento(s) marcado(s) como ${vinculo === "contrato" ? "contrato" : "avulso"}.`);
}

// Só administrador; só avulsos (sem contrato). Apaga também histórico de manutenções/leituras desses equipamentos.
async function excluirMarcados(formData: FormData) {
  "use server";
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const volta = String(formData.get("volta") || "/equipamentos");
  const msg = (m: string) => redirect(volta + (volta.includes("?") ? "&" : "?") + "aviso=" + encodeURIComponent(m));
  const { supabase, perfil } = await getContexto();
  if (perfil?.role !== "admin") msg("Apenas administradores podem excluir equipamentos.");
  if (!ids.length) msg("Marque ao menos um equipamento.");
  if (!formData.get("confirmo")) msg("Marque “Confirmo” para excluir.");
  const { data: avulsos } = await supabase.from("equipment").select("id").in("id", ids).is("contract_id", null).eq("vinculo", "avulso");
  const ok = (avulsos ?? []).map((x: any) => x.id);
  if (!ok.length) msg("Só equipamentos de clientes avulsos (sem contrato) podem ser excluídos.");
  await supabase.from("os_equipment").delete().in("equipment_id", ok);
  const { error } = await supabase.from("equipment").delete().in("id", ok);
  revalidatePath("/equipamentos");
  msg(error ? "Não foi possível excluir: " + error.message : `${ok.length} equipamento(s) avulso(s) excluído(s).` + (ok.length < ids.length ? " Os com contrato foram mantidos." : ""));
}

export default async function Equipamentos({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; aviso?: string }> }) {
  const { q, f, aviso } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const editar = podeEditar(perfil?.role, perfil?.permissions, "equipamentos");
  const { data } = await supabase
    .from("equipment")
    .select("id, code, equipment_number, asset_tag, equipment_type, brand, model, serial_number, location, status, color, contract_id, vinculo, clients(name)")
    .order("equipment_number", { ascending: false })
    .limit(2000);
  const t = (q ?? "").trim().toLowerCase();
  const filtro = f ?? "todos";
  const lista = (data ?? []).filter((e: any) =>
    filtro === "avulso" ? e.vinculo === "avulso" : filtro === "contrato" ? e.vinculo === "contrato" : filtro === "com" ? !!e.asset_tag : filtro === "sem" ? !e.asset_tag : filtro === "avulso-com" ? e.vinculo === "avulso" && !!e.asset_tag : true
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
          <option value="contrato">Contrato</option>
          <option value="avulso">Avulsos (cliente que presta serviço)</option>
          <option value="avulso-com">Avulsos com patrimônio</option>
          <option value="com">Com patrimônio</option>
          <option value="sem">Sem patrimônio</option>
        </select>
        <button className="btn secondary">Filtrar</button>
      </form>
      <form>
      <input type="hidden" name="volta" value={`/equipamentos?f=${filtro}${q ? "&q=" + encodeURIComponent(q) : ""}`} />
      {editar && (
        <p className="muted" style={{ margin: "0 0 10px" }}>
          Clientes avulsos não têm patrimônio próprio. Marque os equipamentos e remova o número:{" "}
          <button className="btn secondary" type="submit" formAction={limparPatrimonio}>Remover patrimônio dos marcados</button>
        </p>
      )}
      {editar && (
        <p className="muted" style={{ margin: "0 0 10px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          Marcar os selecionados como:
          <button className="btn secondary" type="submit" formAction={marcarVinculo} name="vinculo" value="contrato">Contrato</button>
          <button className="btn secondary" type="submit" formAction={marcarVinculo} name="vinculo" value="avulso">Avulso (cliente)</button>
          <span>Cliente que volta? Marque como avulso em vez de excluir: o histórico fica guardado.</span>
        </p>
      )}
      {perfil?.role === "admin" && (
        <p className="muted" style={{ margin: "0 0 10px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          Máquinas de clientes avulsos que não são patrimônio da Infor: marque e exclua (apaga também o histórico delas).
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="confirmo" /> Confirmo</label>
          <button className="btn secondary" type="submit" formAction={excluirMarcados} style={{ color: "#b91c1c" }}>🗑 Excluir avulsos marcados</button>
        </p>
      )}
      <section className="card" style={{ overflowX: "auto" }}>
        <ConfigTabela chave="equipamentos" />
<table className="table">
          <thead>
            <tr>{editar && <th><SelecionarTodos /></th>}<th>Etiqueta</th><th>Equipamento</th><th>Cliente</th><th>Marca</th><th>Modelo</th><th>Nº série</th><th>Cor</th><th>Local</th><th>Contrato</th><th>Status</th><th>Ações</th></tr>
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
                <td>{e.equipment_type ?? "—"}</td>
                <td>{e.clients?.name ?? "—"}</td>
                <td>{e.brand ?? "—"}</td>
                <td>{e.model ?? "—"}</td>
                <td>{e.serial_number ?? "—"}</td>
                <td>{e.color ?? "—"}</td>
                <td>{e.location ?? "—"}</td>
                <td><span className="badge">{e.vinculo === "contrato" ? "Contrato" : "Avulso"}</span></td>
                <td><span className="badge">{e.status}</span></td>
                <td style={{ whiteSpace: "nowrap" }}><Link className="btn primary" href={`/equipamentos/${e.id}`} title="Editar">✎</Link></td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={12} className="muted">Nenhum equipamento encontrado.</td></tr>}
          </tbody>
        </table>
      </section>
      </form>
    </main>
  );
}
