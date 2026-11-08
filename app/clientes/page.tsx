import Link from "next/link";
import { getContexto } from "@/lib/contexto";

export default async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { supabase } = await getContexto();

  let query = supabase.from("clients").select("*").order("name", { ascending: true }).limit(1000);
  if (q) {
    const t = q.replace(/[%,()]/g, " ").trim();
    query = query.or(`name.ilike.%${t}%,trade_name.ilike.%${t}%,document.ilike.%${t}%,phone.ilike.%${t}%,mobile.ilike.%${t}%,city.ilike.%${t}%`);
  }
  const { data: clientes } = await query;

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="title">Clientes</h1>
          <p className="muted">{clientes?.length ?? 0} clientes. Clique no nome para ver e editar o cadastro completo.</p>
        </div>
        <Link className="btn primary" href="/clientes/novo">+ Novo cliente</Link>
      </div>

      <form className="card" style={{ marginBottom: 14, display: "flex", gap: 8 }}>
        <input name="q" defaultValue={q} placeholder="Buscar por nome, CNPJ/CPF, telefone ou cidade" style={{ flex: 1 }} />
        <button className="btn secondary">Buscar</button>
      </form>

      <section className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr><th>Cliente</th><th>CNPJ/CPF</th><th>Contato</th><th>Telefone</th><th>E-mail</th><th>Cidade/UF</th></tr>
          </thead>
          <tbody>
            {clientes?.map((c: any) => (
              <tr key={c.id} style={c.active === false ? { opacity: 0.55 } : undefined}>
                <td><Link href={`/clientes/${c.id}`}><b>{c.name}</b></Link>{c.trade_name ? <div className="muted">{c.trade_name}</div> : null}</td>
                <td>{c.document || "-"}</td>
                <td>{c.contact_name || "-"}</td>
                <td>{[c.phone, c.mobile].filter(Boolean).join(" / ") || "-"}</td>
                <td>{c.email || "-"}</td>
                <td>{[c.city, c.state].filter(Boolean).join("/") || "-"}</td>
              </tr>
            ))}
            {(!clientes || clientes.length === 0) && (
              <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 30 }}>Nenhum cliente encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
