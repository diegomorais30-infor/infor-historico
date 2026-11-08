import Link from "next/link";
import { getContexto } from "@/lib/contexto";

export default async function Equipamentos({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { supabase } = await getContexto();
  const { data } = await supabase
    .from("equipment")
    .select("id, code, equipment_number, asset_tag, equipment_type, brand, model, serial_number, location, status, color, clients(name)")
    .order("equipment_number", { ascending: false })
    .limit(2000);
  const t = (q ?? "").trim().toLowerCase();
  const lista = (data ?? []).filter(
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
      <form className="card" style={{ marginBottom: 14, display: "flex", gap: 8 }}>
        <input name="q" defaultValue={q} placeholder="Buscar patrimônio, modelo, série, cliente ou tipo" style={{ flex: 1 }} />
        <button className="btn secondary">Buscar</button>
      </form>
      <section className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr><th>Patrimônio</th><th>Equipamento</th><th>Cliente</th><th>Nº série</th><th>Local</th><th>Status</th></tr>
          </thead>
          <tbody>
            {lista.map((e: any) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/equipamentos/${e.id}`} style={{ color: "var(--link)", fontWeight: 800 }}>
                    {e.asset_tag ?? e.code ?? `#${e.equipment_number}`}
                  </Link>
                </td>
                <td>{[e.equipment_type, e.brand, e.model].filter(Boolean).join(" ") || "—"}{e.color ? <div className="muted">{e.color}</div> : null}</td>
                <td>{e.clients?.name ?? "—"}</td>
                <td>{e.serial_number ?? "—"}</td>
                <td>{e.location ?? "—"}</td>
                <td><span className="badge">{e.status}</span></td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={6} className="muted">Nenhum equipamento encontrado.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
