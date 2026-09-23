import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function NovoCliente() {
  async function cadastrarCliente(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const name = String(formData.get("name") || "").trim();
    const contact_name = String(formData.get("contact_name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const city = String(formData.get("city") || "").trim();

    if (!name) {
      return;
    }

    const { error } = await supabase.from("clients").insert({
      name,
      contact_name,
      phone,
      city,
    });

    if (error) {
      throw new Error(error.message);
    }

    redirect("/clientes");
  }

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: "0 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 30,
        }}
      >
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700 }}>
            Novo cliente
          </h1>

          <p style={{ color: "#666", marginTop: 8 }}>
            Cadastre um cliente para vincular aos equipamentos.
          </p>
        </div>

        <a
          href="/clientes"
          style={{
            color: "#555",
            textDecoration: "none",
          }}
        >
          ← Voltar
        </a>
      </div>

      <form
        action={cadastrarCliente}
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: 12,
          padding: 30,
          background: "#fff",
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              display: "block",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Nome / Razão Social
          </label>

          <input
            name="name"
            type="text"
            required
            placeholder="Nome do cliente ou empresa"
            style={{
              width: "100%",
              padding: "12px 14px",
              border: "1px solid #ccc",
              borderRadius: 8,
              fontSize: 16,
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              display: "block",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Nome do contato
          </label>

          <input
            name="contact_name"
            type="text"
            placeholder="Pessoa de contato"
            style={{
              width: "100%",
              padding: "12px 14px",
              border: "1px solid #ccc",
              borderRadius: 8,
              fontSize: 16,
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              display: "block",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Telefone
          </label>

          <input
            name="phone"
            type="text"
            placeholder="(38) 99999-9999"
            style={{
              width: "100%",
              padding: "12px 14px",
              border: "1px solid #ccc",
              borderRadius: 8,
              fontSize: 16,
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: 30 }}>
          <label
            style={{
              display: "block",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Cidade
          </label>

          <input
            name="city"
            type="text"
            placeholder="Ex.: Montes Claros"
            style={{
              width: "100%",
              padding: "12px 14px",
              border: "1px solid #ccc",
              borderRadius: 8,
              fontSize: 16,
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          type="submit"
          style={{
            background: "#1677ff",
            color: "#fff",
            padding: "12px 24px",
            border: "none",
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cadastrar cliente
        </button>
      </form>
    </main>
  );
}
