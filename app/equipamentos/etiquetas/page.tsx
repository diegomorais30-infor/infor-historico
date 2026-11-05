import Link from "next/link";
import { getContexto } from "@/lib/contexto";
import Etiquetas from "./etiquetas";

export default async function PaginaEtiquetas() {
  const { supabase, perfil } = await getContexto();
  const { data } = await supabase
    .from("equipment")
    .select("id, code, brand, model, serial_number, qr_token, location, clients(name)")
    .order("code", { ascending: true });

  const empresa = (perfil as any)?.companies;
  const itens = (data ?? []).map((e: any) => ({
    id: e.id as string,
    code: e.code as string,
    marca: [e.brand, e.model].filter(Boolean).join(" "),
    serie: (e.serial_number as string | null) ?? "",
    token: e.qr_token as string,
    cliente: (e.clients?.name as string | null) ?? "",
  }));

  return (
    <main className="wrap">
      <div className="no-print">
        <Link href="/equipamentos" className="link">← Equipamentos</Link>
        <h1 className="title">Etiquetas de QR Code</h1>
        <p className="muted">
          Folha A4 adesiva com 4 etiquetas (2 × 2). Escolha os equipamentos e clique em imprimir. Na janela de
          impressão, use tamanho A4, escala 100% e margens “nenhuma”.
        </p>
      </div>
      <Etiquetas itens={itens} whatsapp={empresa?.whatsapp ?? ""} empresa={empresa?.name ?? ""} />
    </main>
  );
}
