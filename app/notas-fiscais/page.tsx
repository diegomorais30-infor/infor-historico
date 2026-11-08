import Link from "next/link";
import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { podeVer } from "@/lib/permissoes";
import { fmtData } from "@/lib/format";

export default async function NotasFiscais() {
  const { supabase, perfil } = await getContexto();
  if (!podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro")) redirect("/dashboard");
  const { data } = await supabase.from("service_orders").select("id, number, external_invoice_number, closed_at, clients(name)").not("external_invoice_number", "is", null).order("closed_at", { ascending: false }).limit(500);
  const lista: any[] = data ?? [];
  return (
    <main className="wrap" style={{ maxWidth: 900 }}>
      <h1 className="title">Notas fiscais</h1>
      <p className="muted">As notas são emitidas fora do sistema. Aqui ficam registradas as ordens de serviço que têm o número da nota informado.</p>
      <div className="card" style={{ overflowX: "auto", marginTop: 12 }}>
        <table>
          <thead><tr><th>OS</th><th>Cliente</th><th>Nota fiscal</th><th>Fechamento</th></tr></thead>
          <tbody>
            {lista.map((o) => (<tr key={o.id}><td><Link href={`/os/${o.id}`}>#{o.number}</Link></td><td>{o.clients?.name}</td><td>{o.external_invoice_number}</td><td>{fmtData(o.closed_at)}</td></tr>))}
            {!lista.length && <tr><td colSpan={4} className="muted">Nenhuma OS com nota informada.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
