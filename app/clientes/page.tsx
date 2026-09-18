import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Clientes() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: clientes } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 30,
        }}
      >
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700 }}>Clientes</h1>
          <p style={{ color: "#666", marginTop: 8 }}>
            Clientes vinculados aos equipamentos.
          </p>
        </div>

        <a
          href="/clientes/novo"
          style={{
            background: "#1677ff",
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          + Novo cliente
        </a>
      </div>

      <div
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: 12,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f7f7f7", textAlign: "left" }}>
              <th style={{ padding: 14 }}>Cliente</th>
              <th style={{ padding: 14 }}>Contato</th>
              <th style={{ padding: 14 }}>Telefone</th>
              <th style={{ padding: 14 }}>Cidade</th>
            </tr>
          </thead>

          <tbody>
            {clientes?.map((cliente) => (
              <tr key={cliente.id}>
                <td style={{ padding: 14, borderTop: "1px solid #eee" }}>
                  {cliente.name}
                </td>

                <td style={{ padding: 14, borderTop: "1px solid #eee" }}>
                  {cliente.contact_name || "-"}
                </td>

                <td style={{ padding: 14, borderTop: "1px solid #eee" }}>
                  {cliente.phone || "-"}
                </td>

                <td style={{ padding: 14, borderTop: "1px solid #eee" }}>
                  {cliente.city || "-"}
                </td>
              </tr>
            ))}

            {(!clientes || clientes.length === 0) && (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    padding: 30,
                    textAlign: "center",
                    color: "#777",
                  }}
                >
                  Nenhum cliente cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
