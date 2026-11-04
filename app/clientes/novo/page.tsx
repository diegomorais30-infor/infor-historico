import Link from "next/link";
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
    <main className="wrap" style={{ maxWidth: 900 }}>
      <div className="headrow" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="title">Novo cliente</h1>
          <p className="muted">Cadastre um cliente para vincular aos equipamentos.</p>
        </div>
        <Link href="/clientes" className="muted">
          ← Voltar
        </Link>
      </div>

      <form action={cadastrarCliente} className="card grid" style={{ gap: 18 }}>
        <label className="field">
          Nome / Razão Social
          <input name="name" type="text" required placeholder="Nome do cliente ou empresa" />
        </label>
        <label className="field">
          Nome do contato
          <input name="contact_name" type="text" placeholder="Pessoa de contato" />
        </label>
        <label className="field">
          Telefone
          <input name="phone" type="text" placeholder="(38) 99999-9999" />
        </label>
        <label className="field">
          Cidade
          <input name="city" type="text" placeholder="Ex.: Montes Claros" />
        </label>
        <div>
          <button type="submit" className="btn primary">
            Cadastrar cliente
          </button>
        </div>
      </form>
    </main>
  );
}
