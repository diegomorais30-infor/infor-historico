import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { hojeBR, mesRotulo, somaMes } from "@/lib/format";

function voltar(mes: string, tipo: "erro" | "aviso", texto: string): never {
  redirect(`/leituras?mes=${mes}&${tipo}=${encodeURIComponent(texto)}`);
}

async function salvarLeitura(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const mes = String(formData.get("mes"));
  const equipamento = String(formData.get("equipamento"));
  if (!/^\d{4}-\d{2}$/.test(mes)) redirect("/leituras");

  const pb = Number(formData.get("counter_bw"));
  const cor = Number(formData.get("counter_color") || 0);
  if (!Number.isFinite(pb) || pb < 0 || formData.get("counter_bw") === "") {
    voltar(mes, "erro", "Informe o contador P&B.");
  }
  if (!Number.isFinite(cor) || cor < 0) voltar(mes, "erro", "Contador colorido inválido.");

  // Não aceita contador menor que o da leitura anterior (erro de digitação)
  const { data: anterior } = await supabase
    .from("meter_readings")
    .select("counter_bw, counter_color, reference_month")
    .eq("equipment_id", equipamento)
    .lt("reference_month", `${mes}-01`)
    .order("reference_month", { ascending: false })
    .limit(1);
  const ant = anterior?.[0];
  if (ant && (pb < Number(ant.counter_bw) || cor < Number(ant.counter_color))) {
    voltar(mes, "erro", `A leitura é menor que a de ${mesRotulo(ant.reference_month)} (${ant.counter_bw} / ${ant.counter_color}). Confira os números.`);
  }

  const { error } = await supabase.from("meter_readings").upsert(
    {
      equipment_id: equipamento,
      reference_month: `${mes}-01`,
      reading_date: hojeBR(),
      counter_bw: Math.round(pb),
      counter_color: Math.round(cor),
      source: "manual",
      created_by: user.id,
    },
    { onConflict: "equipment_id,reference_month" }
  );
  if (error) voltar(mes, "erro", error.message);

  revalidatePath("/leituras");
  redirect(`/leituras?mes=${mes}`);
}

export default async function Leituras({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; erro?: string; aviso?: string }>;
}) {
  const { mes: mesParam, erro } = await searchParams;
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : hojeBR().slice(0, 7);
  const { supabase } = await getContexto();

  const { data: equipamentos } = await supabase
    .from("equipment")
    .select("id, code, brand, model, serial_number, contract_id, clients(name), contracts(code)")
    .eq("status", "active")
    .order("code");
  const lista: any[] = equipamentos ?? [];

  const { data: doMes } = await supabase.from("meter_readings").select("*").eq("reference_month", `${mes}-01`);
  const leituraDoMes = new Map<string, any>((doMes ?? []).map((l: any) => [l.equipment_id, l]));

  // Leitura anterior mais recente de cada equipamento
  const { data: antigas } = await supabase
    .from("meter_readings")
    .select("equipment_id, counter_bw, counter_color, reference_month")
    .lt("reference_month", `${mes}-01`)
    .order("reference_month", { ascending: false });
  const anterior = new Map<string, any>();
  (antigas ?? []).forEach((l: any) => {
    if (!anterior.has(l.equipment_id)) anterior.set(l.equipment_id, l);
  });

  const lidas = lista.filter((e) => leituraDoMes.has(e.id)).length;

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="title">Leituras dos contadores</h1>
          <p className="muted">
            {lidas} de {lista.length} impressoras lidas em {mesRotulo(mes)}.
          </p>
        </div>
        <div className="inline" style={{ display: "flex", gap: 8 }}>
          <Link className="btn secondary" href={`/leituras?mes=${somaMes(mes, -1)}`}>
            ← {mesRotulo(somaMes(mes, -1))}
          </Link>
          <Link className="btn secondary" href={`/leituras?mes=${somaMes(mes, 1)}`}>
            {mesRotulo(somaMes(mes, 1))} →
          </Link>
        </div>
      </div>

      {erro && <div className="error" style={{ marginBottom: 14 }}>{erro}</div>}

      <section className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Impressora</th>
              <th>Cliente / Contrato</th>
              <th>Leitura anterior</th>
              <th>Contador P&amp;B</th>
              <th>Contador cor</th>
              <th>Páginas no mês</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((e) => {
              const atual = leituraDoMes.get(e.id);
              const ant = anterior.get(e.id);
              const paginas = atual && ant ? Number(atual.counter_bw) - Number(ant.counter_bw) : null;
              const paginasCor = atual && ant ? Number(atual.counter_color) - Number(ant.counter_color) : null;
              return (
                <tr key={e.id}>
                  <td>
                    <Link href={`/equipamentos/${e.id}`} style={{ color: "var(--link)", fontWeight: 800 }}>
                      {e.code}
                    </Link>
                    <div className="muted">
                      {e.brand} {e.model}
                    </div>
                  </td>
                  <td>
                    {e.clients?.name ?? "—"}
                    <div className="muted">{e.contracts?.code ?? "sem contrato"}</div>
                  </td>
                  <td>
                    {ant ? (
                      <>
                        {ant.counter_bw} / {ant.counter_color}
                        <div className="muted">{mesRotulo(ant.reference_month)}</div>
                      </>
                    ) : (
                      <span className="muted">primeira leitura</span>
                    )}
                  </td>
                  <td colSpan={2}>
                    <form action={salvarLeitura} className="inline" id={`f-${e.id}`}>
                      <input type="hidden" name="equipamento" value={e.id} />
                      <input type="hidden" name="mes" value={mes} />
                      <input
                        name="counter_bw"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="P&B"
                        aria-label="Contador P&B"
                        defaultValue={atual?.counter_bw ?? ""}
                        required
                      />
                      <input
                        name="counter_color"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Cor"
                        aria-label="Contador colorido"
                        defaultValue={atual?.counter_color ?? 0}
                      />
                      <button className="btn secondary">Salvar</button>
                    </form>
                  </td>
                  <td>
                    {paginas !== null ? (
                      <b>
                        {paginas}
                        {paginasCor ? ` + ${paginasCor} cor` : ""}
                      </b>
                    ) : atual ? (
                      <span className="muted">—</span>
                    ) : (
                      <span className="badge warn">Falta ler</span>
                    )}
                  </td>
                  <td></td>
                </tr>
              );
            })}
            {!lista.length && (
              <tr>
                <td colSpan={7} className="muted">
                  Nenhum equipamento ativo cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
