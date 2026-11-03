import Link from "next/link";
import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { hojeBR } from "@/lib/format";

function numero(v: FormDataEntryValue | null) {
  return Number(String(v ?? "").replace(",", ".")) || 0;
}

function dataOuNulo(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

async function criarContrato(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const client_id = String(formData.get("client_id") || "");
  if (!client_id) redirect("/contratos/novo?erro=" + encodeURIComponent("Escolha o cliente."));

  const { data, error } = await supabase
    .from("contracts")
    .insert({
      client_id,
      start_date: dataOuNulo(formData.get("start_date")) ?? hojeBR(),
      end_date: dataOuNulo(formData.get("end_date")),
      monthly_fee: numero(formData.get("monthly_fee")),
      pages_included_bw: Math.round(numero(formData.get("pages_included_bw"))),
      pages_included_color: Math.round(numero(formData.get("pages_included_color"))),
      extra_page_price_bw: numero(formData.get("extra_page_price_bw")),
      extra_page_price_color: numero(formData.get("extra_page_price_color")),
      billing_day: Math.min(28, Math.max(1, Math.round(numero(formData.get("billing_day")) || 5))),
      next_adjustment_date: dataOuNulo(formData.get("next_adjustment_date")),
      notes: String(formData.get("notes") || "").trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    const texto = error?.code === "42501" ? "Somente gerente ou administrador cria contratos." : (error?.message ?? "Erro ao salvar.");
    redirect("/contratos/novo?erro=" + encodeURIComponent(texto));
  }
  redirect(`/contratos/${data.id}`);
}

export default async function NovoContrato({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const { supabase } = await getContexto();
  const { data: clientes } = await supabase.from("clients").select("id, name").eq("active", true).order("name");

  return (
    <main className="wrap" style={{ maxWidth: 860 }}>
      <Link href="/contratos" className="muted">
        ← Contratos
      </Link>
      <h1 className="title" style={{ marginTop: 12 }}>
        Novo contrato
      </h1>
      <p className="muted">Depois de salvar, você vincula as impressoras ao contrato.</p>

      <form action={criarContrato} className="card grid g2" style={{ marginTop: 18 }}>
        <label className="field" style={{ gridColumn: "1/-1" }}>
          Cliente
          <select name="client_id" required defaultValue="">
            <option value="">Selecione...</option>
            {(clientes ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Início
          <input name="start_date" type="date" defaultValue={hojeBR()} />
        </label>
        <label className="field">
          Fim da vigência
          <input name="end_date" type="date" />
        </label>
        <label className="field">
          Mensalidade (R$)
          <input name="monthly_fee" inputMode="decimal" placeholder="0,00" required />
        </label>
        <label className="field">
          Dia da cobrança (1 a 28)
          <input name="billing_day" type="number" min="1" max="28" defaultValue="5" />
        </label>
        <label className="field">
          Franquia P&amp;B (páginas/mês)
          <input name="pages_included_bw" type="number" min="0" defaultValue="0" />
        </label>
        <label className="field">
          Franquia colorida (páginas/mês)
          <input name="pages_included_color" type="number" min="0" defaultValue="0" />
        </label>
        <label className="field">
          Excedente P&amp;B (R$ por página)
          <input name="extra_page_price_bw" inputMode="decimal" placeholder="0,10" />
        </label>
        <label className="field">
          Excedente colorido (R$ por página)
          <input name="extra_page_price_color" inputMode="decimal" placeholder="0,50" />
        </label>
        <label className="field" style={{ gridColumn: "1/-1" }}>
          Próximo reajuste
          <input name="next_adjustment_date" type="date" />
        </label>
        <label className="field" style={{ gridColumn: "1/-1" }}>
          Observações
          <textarea name="notes" rows={3} />
        </label>
        {erro && (
          <div className="error" style={{ gridColumn: "1/-1" }}>
            {erro}
          </div>
        )}
        <div style={{ gridColumn: "1/-1" }}>
          <button className="btn primary">Salvar contrato</button>
        </div>
      </form>
    </main>
  );
}
