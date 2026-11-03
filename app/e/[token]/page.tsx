import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUS_EQUIPAMENTO, TIPOS_MANUTENCAO, fmtData } from "@/lib/format";
import Solicitar from "./solicitar";

export const metadata = { title: "Histórico do equipamento", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Manutencao = {
  service_date: string;
  maintenance_type: string;
  service_performed: string | null;
  next_preventive_date: string | null;
};

// Página aberta ao ler o QR code colado na impressora. Não exige login:
// os dados vêm da função get_public_equipment, que devolve só o necessário.
export default async function PaginaPublica({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID.test(token)) notFound();

  const supabase = await createClient();
  const { data: e } = await supabase.rpc("get_public_equipment", { p_token: token });
  if (!e) notFound();

  const historico: Manutencao[] = e.history ?? [];

  return (
    <main className="wrap" style={{ maxWidth: 760 }}>
      <div className="muted">{e.company}</div>
      <h1 className="title">
        {e.brand} {e.model}
      </h1>
      <div className="muted">{e.code}</div>

      <div className="grid g2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="muted">Nº de série</div>
          <b>{e.serial_number ?? "—"}</b>
        </div>
        <div className="card">
          <div className="muted">Localização</div>
          <b>{e.location ?? "—"}</b>
        </div>
        <div className="card">
          <div className="muted">Situação</div>
          <b>{STATUS_EQUIPAMENTO[e.status] ?? e.status}</b>
        </div>
        <div className="card">
          <div className="muted">Próxima preventiva</div>
          <b>{fmtData(e.next_preventive_date)}</b>
        </div>
      </div>

      <Solicitar
        token={token}
        whatsapp={e.whatsapp ?? null}
        code={e.code}
        equipamento={`${e.brand ?? ""} ${e.model ?? ""}`.trim()}
        local={e.location ?? null}
      />

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Histórico de manutenção</h2>
        {historico.map((m, i) => (
          <article className="history" key={i}>
            <b>{TIPOS_MANUTENCAO[m.maintenance_type] ?? m.maintenance_type}</b>
            <div className="muted">{fmtData(m.service_date)}</div>
            <p>{m.service_performed ?? "—"}</p>
          </article>
        ))}
        {!historico.length && <p className="muted">Nenhuma manutenção registrada.</p>}
      </section>

      <p className="muted" style={{ marginTop: 24, fontSize: 13 }}>
        Técnicos: para registrar uma manutenção, entre no sistema com seu login.
      </p>
    </main>
  );
}
