import Link from "next/link";
import { getContexto } from "@/lib/contexto";

export default async function Clientes() {
  const { supabase } = await getContexto();

  const { data: clientes } = await supabase.from("clients").select("*").order("name", { ascending: true });

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="title">Clientes</h1>
          <p className="muted">Clientes vinculados aos equipamentos.</p>
        </div>
        <Link className="btn primary" href="/clientes/novo">
          + Novo cliente
        </Link>
      </div>

      <section className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contato</th>
              <th>Telefone</th>
              <th>Cidade</th>
            </tr>
          </thead>
          <tbody>
            {clientes?.map((cliente: any) => (
              <tr key={cliente.id}>
                <td>{cliente.name}</td>
                <td>{cliente.contact_name || "-"}</td>
                <td>{cliente.phone || "-"}</td>
                <td>{cliente.city || "-"}</td>
              </tr>
            ))}
            {(!clientes || clientes.length === 0) && (
              <tr>
                <td colSpan={4} className="muted" style={{ textAlign: "center", padding: 30 }}>
                  Nenhum cliente cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
