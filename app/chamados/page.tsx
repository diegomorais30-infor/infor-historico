import Link from "next/link";
import ConfigTabela from "@/components/config-tabela";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { STATUS_CHAMADO, fmtDataHora, telefoneWhatsapp } from "@/lib/format";

async function mudarStatus(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["open", "in_progress", "done", "canceled"].includes(status)) redirect("/chamados");

  const campos: Record<string, unknown> = {
    status,
    resolved_at: status === "done" || status === "canceled" ? new Date().toISOString() : null,
  };
  if (status === "in_progress") campos.assigned_to = user.id;

  const { error } = await supabase.from("service_requests").update(campos).eq("id", id);
  if (error) redirect("/chamados?erro=" + encodeURIComponent(error.message));
  revalidatePath("/chamados");
  redirect("/chamados" + (formData.get("filtro") ? `?filtro=${formData.get("filtro")}` : ""));
}

const FILTROS: Record<string, string> = {
  abertos: "Em aberto",
  concluidos: "Concluídos",
  todos: "Todos",
};

export default async function Chamados({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; erro?: string }>;
}) {
  const { filtro: filtroParam, erro } = await searchParams;
  const filtro = filtroParam && FILTROS[filtroParam] ? filtroParam : "abertos";
  const { supabase, perfil } = await getContexto();
  const empresa = (perfil as any)?.companies?.name ?? "";

  let consulta = supabase
    .from("service_requests")
    .select("*, equipment(id, code, brand, model, location, clients(name))")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filtro === "abertos") consulta = consulta.in("status", ["open", "in_progress"]);
  if (filtro === "concluidos") consulta = consulta.in("status", ["done", "canceled"]);
  const { data } = await consulta;
  const chamados: any[] = data ?? [];

  return (
    <main className="wrap">
      <h1 className="title">Chamados</h1>
      <p className="muted">Pedidos de manutenção feitos pelos clientes ao ler o QR code da impressora.</p>

      <nav className="nav">
        {Object.entries(FILTROS).map(([valor, nome]) => (
          <Link key={valor} className={valor === filtro ? "btn primary" : "btn secondary"} href={`/chamados?filtro=${valor}`}>
            {nome}
          </Link>
        ))}
      </nav>

      {erro && <div className="error" style={{ marginBottom: 14 }}>{erro}</div>}

      <section className="card">
        <ConfigTabela chave="chamados" />
<table className="table">
          <thead>
            <tr>
              <th>Protocolo</th>
              <th>Impressora</th>
              <th>Solicitante</th>
              <th>Problema</th>
              <th>Situação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {chamados.map((c) => {
              const eq = c.equipment;
              const resposta = `Olá, ${c.requester_name}! Aqui é da ${empresa}. Sobre o chamado ${c.protocol} (${eq?.code ?? ""}): `;
              return (
                <tr key={c.id}>
                  <td>
                    <b>{c.protocol}</b>
                    <div className="muted">{fmtDataHora(c.created_at)}</div>
                  </td>
                  <td>
                    {eq ? (
                      <Link href={`/equipamentos/${eq.id}`} style={{ color: "var(--link)", fontWeight: 800 }}>
                        {eq.code}
                      </Link>
                    ) : (
                      "—"
                    )}
                    <div className="muted">
                      {eq?.brand} {eq?.model}
                    </div>
                    <div className="muted">
                      {eq?.clients?.name ?? "—"} · {eq?.location ?? "—"}
                    </div>
                  </td>
                  <td>
                    {c.requester_name}
                    <div>
                      <a
                        href={`https://wa.me/${telefoneWhatsapp(c.requester_phone)}?text=${encodeURIComponent(resposta)}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "var(--link)", fontWeight: 700 }}
                      >
                        {c.requester_phone} · WhatsApp
                      </a>
                    </div>
                  </td>
                  <td style={{ maxWidth: 280 }}>{c.description}</td>
                  <td>
                    <span className={c.status === "done" ? "badge" : "badge warn"}>{STATUS_CHAMADO[c.status]}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {c.status === "open" && (
                        <form action={mudarStatus}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="filtro" value={filtro} />
                          <input type="hidden" name="status" value="in_progress" />
                          <button className="btn secondary">Atender</button>
                        </form>
                      )}
                      {(c.status === "open" || c.status === "in_progress") && eq && (
                        <>
                          <Link className="btn secondary" href={`/os/nova?chamado=${c.id}`}>
                            Gerar OS
                          </Link>
                          <Link className="btn secondary" href={`/equipamentos/${eq.id}/manutencao/nova`}>
                            Registrar manutenção
                          </Link>
                        </>
                      )}
                      {(c.status === "open" || c.status === "in_progress") && (
                        <form action={mudarStatus}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="filtro" value={filtro} />
                          <input type="hidden" name="status" value="done" />
                          <button className="btn secondary">Concluir</button>
                        </form>
                      )}
                      {(c.status === "done" || c.status === "canceled") && (
                        <form action={mudarStatus}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="filtro" value={filtro} />
                          <input type="hidden" name="status" value="open" />
                          <button className="btn secondary">Reabrir</button>
                        </form>
                      )}
                      {(c.status === "open" || c.status === "in_progress") && (
                        <form action={mudarStatus}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="filtro" value={filtro} />
                          <input type="hidden" name="status" value="canceled" />
                          <button className="btn danger">Cancelar</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!chamados.length && (
              <tr>
                <td colSpan={6} className="muted">
                  Nenhum chamado nesta lista.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
