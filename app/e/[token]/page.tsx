import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Solicitar from "./solicitar";

export const metadata = { title: "Solicitar manutenção", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Página aberta ao ler o QR code colado na impressora. Não exige login:
// Mostra só a identificação do equipamento e o pedido de manutenção. O histórico
// é interno: aparece apenas um atalho para quem estiver logado na equipe.
export default async function PaginaPublica({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID.test(token)) notFound();

  const supabase = await createClient();
  const { data: e } = await supabase.rpc("get_public_equipment", { p_token: token });
  if (!e) notFound();

  // Se quem lê o QR é da equipe (logado), a regra de acesso do banco devolve o equipamento.
  const { data: interno } = await supabase.from("equipment").select("id").eq("qr_token", token).maybeSingle();

  return (
    <main className="wrap" style={{ maxWidth: 760 }}>
      <div className="muted">{e.company}</div>
      <h1 className="title">
        {e.brand} {e.model}
      </h1>
      <div className="muted">{e.code}</div>

      {e.serial_number && <div className="muted">Nº de série: {e.serial_number}</div>}

      {interno && (
        <div className="card" style={{ marginTop: 18 }}>
          <b>Equipe Infor</b>
          <p className="muted">Você está logado. Abra a ficha interna para ver o histórico e registrar manutenção.</p>
          <Link className="btn primary" href={`/equipamentos/${interno.id}`}>
            Abrir ficha interna
          </Link>
        </div>
      )}

      <Solicitar
        token={token}
        whatsapp={e.whatsapp ?? null}
        code={e.code}
        equipamento={`${e.brand ?? ""} ${e.model ?? ""}`.trim()}
        local={null}
      />

    </main>
  );
}
