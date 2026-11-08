import Link from "next/link";
import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { CamposCliente, lerCliente } from "../campos";

export default async function NovoCliente() {
  await getContexto();

  async function cadastrarCliente(formData: FormData) {
    "use server";
    const { supabase } = await getContexto();
    const dados = lerCliente(formData);
    if (!dados.name) return;
    const { error } = await supabase.from("clients").insert(dados);
    if (error) throw new Error(error.message);
    redirect("/clientes");
  }

  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <div className="headrow" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="title">Novo cliente</h1>
          <p className="muted">Cadastre um cliente para vincular aos equipamentos.</p>
        </div>
        <Link href="/clientes" className="muted">← Voltar</Link>
      </div>
      <form action={cadastrarCliente} className="card grid" style={{ gap: 14 }}>
        <CamposCliente />
        <div><button type="submit" className="btn primary">Cadastrar cliente</button></div>
      </form>
    </main>
  );
}
