import Link from "next/link";
import { redirect } from "next/navigation";
import ConfigTabela from "@/components/config-tabela";
import { getContexto } from "@/lib/contexto";
import { fmtData, moeda } from "@/lib/format";
import { podeEditar } from "@/lib/permissoes";

async function nova() {
  "use server";
  const { supabase } = await getContexto();
  const { data: ult } = await supabase.from("purchases").select("number").order("number", { ascending: false }).limit(1);
  const number = Number((ult as any)?.[0]?.number ?? 0) + 1;
  const { data, error } = await supabase.from("purchases").insert({ number }).select("id").single();
  if (error) redirect("/compras?erro=" + encodeURIComponent(error.message));
  redirect(`/compras/${(data as any).id}`);
}

const tag = (x: string, t: string) => x.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`))?.[1]?.trim() ?? "";
const dec = (v: string) => Number(v.replace(",", ".")) || 0;
const des = (v: string) => v.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");

async function importarXML(fd: FormData) {
  "use server";
  const { supabase } = await getContexto();
  const arq = fd.get("xml");
  if (!(arq instanceof File) || !arq.size) redirect("/compras?erro=" + encodeURIComponent("Escolha o arquivo XML da nota."));
  const xml = await (arq as File).text();
  if (!xml.includes("<det ") && !xml.includes("<det>")) redirect("/compras?erro=" + encodeURIComponent("XML inválido: não encontrei itens de NF-e."));
  const emit = tag(xml, "emit");
  const nome = des(tag(emit, "xNome"));
  const doc = tag(emit, "CNPJ") || tag(emit, "CPF");
  const nNF = tag(xml, "nNF");
  const dh = tag(xml, "dhEmi") || tag(xml, "dEmi");
  let supplier_id: string | null = null;
  if (nome || doc) {
    const { data: ex } = doc ? await supabase.from("suppliers").select("id").eq("document", doc).maybeSingle() : { data: null as any };
    if (ex) supplier_id = (ex as any).id;
    else {
      const { data: nv } = await supabase.from("suppliers").insert({ name: nome || doc, document: doc || null, city: des(tag(emit, "xMun")) || null, state: tag(emit, "UF") || null }).select("id").single();
      supplier_id = (nv as any)?.id ?? null;
    }
  }
  const { data: ult } = await supabase.from("purchases").select("number").order("number", { ascending: false }).limit(1);
  const number = Number((ult as any)?.[0]?.number ?? 0) + 1;
  const { data: c, error } = await supabase
    .from("purchases")
    .insert({ number, supplier_id, purchased_at: dh ? new Date(dh).toISOString() : new Date().toISOString(), notes: nNF ? `Importada do XML da NF-e ${nNF}` : "Importada de XML" })
    .select("id")
    .single();
  if (error || !c) redirect("/compras?erro=" + encodeURIComponent(error?.message ?? "Erro ao criar a compra."));
  const { data: pecas } = await supabase.from("parts").select("id, name, barcode").limit(5000);
  const dets = xml.match(/<det[\s>][\s\S]*?<\/det>/g) ?? [];
  const linhas = dets.map((d) => {
    const desc = des(tag(d, "xProd"));
    const ean = tag(d, "cEAN");
    const achada = (pecas ?? []).find((p: any) => (ean && ean !== "SEM GTIN" && p.barcode === ean) || p.name?.toLowerCase() === desc.toLowerCase());
    return { purchase_id: (c as any).id, part_id: (achada as any)?.id ?? null, description: desc, quantity: dec(tag(d, "qCom")) || 1, unit_price: dec(tag(d, "vUnCom")), discount: dec(tag(d, "vDesc")) };
  });
  if (linhas.length) await supabase.from("purchase_items").insert(linhas);
  redirect(`/compras/${(c as any).id}`);
}

export default async function Compras({ searchParams }: { searchParams: Promise<{ q?: string; de?: string; ate?: string; erro?: string }> }) {
  const { q, de, ate, erro } = await searchParams;
  const { supabase, perfil } = await getContexto();
  const editar = podeEditar(perfil?.role, (perfil as any)?.permissions, "pecas");
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const ini = de || hoje.slice(0, 8) + "01";
  const fim = ate || hoje.slice(0, 8) + "31";

  const { data } = await supabase
    .from("purchases")
    .select("id, number, purchased_at, discount, legacy_total, invoiced, suppliers(name)")
    .gte("purchased_at", ini + "T00:00:00-03:00")
    .lte("purchased_at", fim + "T23:59:59-03:00")
    .order("purchased_at", { ascending: false })
    .limit(500);
  const compras: any[] = data ?? [];
  const ids = compras.map((c) => c.id);
  const [{ data: its }, { data: cts }] = ids.length
    ? await Promise.all([
        supabase.from("purchase_items").select("purchase_id, description, quantity, received_qty, unit_price, discount").in("purchase_id", ids),
        supabase.from("purchase_costs").select("purchase_id, amount").in("purchase_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const info = (c: any) => {
    const itens = (its ?? []).filter((i: any) => i.purchase_id === c.id);
    const custos = (cts ?? []).filter((x: any) => x.purchase_id === c.id).reduce((s: number, x: any) => s + Number(x.amount), 0);
    const sub = itens.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_price) - Number(i.discount), 0);
    const total = itens.length ? Math.max(sub + custos - Number(c.discount), 0) : Number(c.legacy_total ?? 0);
    const rec = itens.length ? itens.every((i: any) => Number(i.received_qty) >= Number(i.quantity)) : true;
    return { itens, total, rec };
  };
  const t = (q ?? "").trim().toLowerCase();
  const lista = compras.filter((c) => {
    if (!t) return true;
    const { itens } = info(c);
    return [String(c.number), c.suppliers?.name, ...itens.map((i: any) => i.description)].filter(Boolean).some((x: string) => x.toLowerCase().includes(t));
  });

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 14 }}>
        <div>
          <h1 className="title">Compras</h1>
          <div className="muted">Entradas de mercadoria dos fornecedores e os pedidos de compra</div>
        </div>
        {editar && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <form action={importarXML} encType="multipart/form-data" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="file" name="xml" accept=".xml,text/xml" aria-label="XML da NF-e" />
              <button className="btn secondary">📄 Importar XML</button>
            </form>
            <form action={nova}>
              <button className="btn primary">+ Nova compra</button>
            </form>
          </div>
        )}
      </div>
      {erro && <div className="error" style={{ marginBottom: 10 }}>{erro}</div>}
      <form className="card" style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <label className="field">De<input type="date" name="de" defaultValue={ini} /></label>
        <label className="field">Até<input type="date" name="ate" defaultValue={fim} /></label>
        <label className="field" style={{ flex: 1, minWidth: 200 }}>Buscar<input name="q" defaultValue={q ?? ""} placeholder="Número, fornecedor ou produto" /></label>
        <button className="btn secondary">Filtrar</button>
      </form>
      <section className="card" style={{ overflowX: "auto" }}>
        <ConfigTabela chave="compras" />
        <table className="table">
          <thead><tr><th>#</th><th>Data</th><th>Fornecedor</th><th>Produtos</th><th>Total da compra</th><th>Ações</th></tr></thead>
          <tbody>
            {lista.map((c) => {
              const x = info(c);
              return (
                <tr key={c.id}>
                  <td><Link href={`/compras/${c.id}`} style={{ color: "var(--link)", fontWeight: 800 }}>{c.number}</Link></td>
                  <td>{fmtData(c.purchased_at)}</td>
                  <td>{c.suppliers?.name ?? "—"}</td>
                  <td>
                    <span className="badge" style={{ background: x.rec ? "#dcfce7" : "#fef3c7", color: x.rec ? "#166534" : "#92400e" }}>{x.rec ? "Recebido" : "Pendente"}</span>{" "}
                    {x.itens.slice(0, 2).map((i: any) => i.description).join(", ")}{x.itens.length > 2 ? ` +${x.itens.length - 2}` : ""}
                  </td>
                  <td><span className="badge">{c.invoiced ? "Faturado" : "Não faturado"}</span><div><b>{moeda(x.total)}</b></div></td>
                  <td><Link className="btn primary" href={`/compras/${c.id}`} title="Editar">✎</Link></td>
                </tr>
              );
            })}
            {!lista.length && <tr><td colSpan={6} className="muted" style={{ textAlign: "center" }}>Nenhuma compra no período.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
