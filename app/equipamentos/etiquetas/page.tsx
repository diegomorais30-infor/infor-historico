import Link from "next/link";
import { getContexto } from "@/lib/contexto";
import Etiquetas from "./etiquetas";

export default async function PaginaEtiquetas() {
  const { supabase, perfil } = await getContexto();
  const { data } = await supabase
    .from("equipment")
    .select("id, code, brand, model, serial_number, asset_tag, qr_token, location, contract_id, vinculo, label_accepted, clients(name)")
    .neq("status", "inactive")
    .order("code", { ascending: true });
  const { data: emp } = await supabase.from("companies").select("slug").maybeSingle();

  const empresa = (perfil as any)?.companies;
  const itens = (data ?? []).filter((e: any) => e.vinculo === "contrato" || e.label_accepted).map((e: any) => ({
    id: e.id as string,
    code: e.code as string,
    marca: [e.brand, e.model].filter(Boolean).join(" "),
    serie: (e.serial_number as string | null) ?? "",
    token: e.qr_token as string,
    tag: (e.asset_tag as string | null) ?? "",
    cliente: (e.clients?.name as string | null) ?? "",
  }));

  return (
    <main className="wrap">
      <div className="no-print">
        <Link href="/equipamentos" className="link">← Equipamentos</Link>
        <h1 className="title">Etiquetas de QR Code</h1>
        <p className="muted">
          O QR de cada etiqueta usa o número do patrimônio (o mesmo número que já está colado na impressora). Folha A4 adesiva com 4 etiquetas (2 × 2). Equipamentos de clientes avulsos só aparecem aqui depois que o cliente (ou a Infor) aceitar a etiqueta, na página do equipamento. Escolha os equipamentos e clique em imprimir. Na janela de
          impressão, use tamanho A4, escala 100% e margens “nenhuma”.
        </p>
      </div>
      <Etiquetas slug={(emp as any)?.slug ?? ""} itens={itens} whatsapp={empresa?.whatsapp ?? ""} empresa={empresa?.name ?? ""} />
    </main>
  );
}
