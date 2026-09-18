import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function NovoCliente() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
    const contact_name = String(
      formData.get("contact_name") || ""
    ).trim();
    const phone = String(formData.get("phone") || "").trim();
    const city = String(formData.get("city") || "").trim();

    if (!name) {
      return;
    }

    const { error } = await supabase.from("clientes").insert({
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
