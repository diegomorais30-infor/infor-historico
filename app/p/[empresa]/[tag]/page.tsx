import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Solicitar from "@/app/e/[token]/solicitar";

export const metadata = { title: "Solicitar manutenção", robots: { index: false, follow: false } };

// QR code baseado no número do patrimônio: /p/<empresa>/<patrimonio>
export default async function PaginaPatrimonio({ params }: { params: Promise<{ empresa: string; tag: string }> }) {
  const { empresa, tag } = await params;
  const patrimonio = decodeURIComponent(tag);
  const supabase = await createClient();
  const { data: e } = await supabase.rpc("get_public_equipment_by_tag", { p_slug: empresa, p_tag: patrimonio });
  if (!e) notFound();

  const { data: interno } = await supabase.from("equipment").select("id").eq("qr_token", e.token).maybeSingle();

  return (
    <main className="wrap" style={{ maxWidth: 760 }}>
      <div className="muted">{e.company}</div>
      <h1 className="title">
        {e.brand} {e.model}
      </h1>
      <div className="muted">Patrimônio {e.asset_tag}</div>
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
        token={e.token}
        whatsapp={e.whatsapp ?? null}
        code={`Patrimônio ${e.asset_tag}`}
        equipamento={`${e.brand ?? ""} ${e.model ?? ""}`.trim()}
        local={null}
      />
    </main>
  );
}
