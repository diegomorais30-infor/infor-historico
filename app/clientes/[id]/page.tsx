import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { CamposCliente, lerCliente } from "../campos";

export default async function Cliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getContexto();
  const { data: c } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const { data: eqs } = await supabase.from("equipment").select("id, equipment_type, brand, model, serial_number, asset_tag").eq("client_id", id).order("asset_tag");

  async function salvar(fd: FormData) {
    "use server";
    const { supabase } = await getContexto();
    const dados = lerCliente(fd);
    if (!dados.name) return;
    await supabase.from("clients").update({ ...dados, active: fd.get("active") === "on" }).eq("id", id);
    revalidatePath("/clientes");
    redirect("/clientes");
  }

  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <div className="headrow" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="title">{c.name}</h1>
          <p className="muted">Cadastro completo do cliente.</p>
        </div>
        <Link href="/clientes" className="muted">← Voltar</Link>
      </div>
      <form action={salvar} className="card grid" style={{ gap: 14 }}>
        <CamposCliente c={c} />
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="active" defaultChecked={c.active !== false} /> Cliente ativo
        </label>
        <div><button type="submit" className="btn primary">Salvar</button></div>
      </form>

      <section className="card" style={{ marginTop: 14 }}>
        <b>Equipamentos deste cliente ({eqs?.length ?? 0})</b>
        <table className="table" style={{ marginTop: 8 }}>
          <thead><tr><th>Patrimônio</th><th>Tipo</th><th>Marca / modelo</th><th>Série</th></tr></thead>
          <tbody>
            {(eqs ?? []).map((e: any) => (
              <tr key={e.id}>
                <td><Link href={`/equipamentos/${e.id}`}>{e.asset_tag || "-"}</Link></td>
                <td>{e.equipment_type}</td>
                <td>{[e.brand, e.model].filter(Boolean).join(" ") || "-"}</td>
                <td>{e.serial_number || "-"}</td>
              </tr>
            ))}
            {(!eqs || eqs.length === 0) && <tr><td colSpan={4} className="muted">Nenhum equipamento.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
