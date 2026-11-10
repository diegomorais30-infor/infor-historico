import Link from "next/link";
import { getContexto } from "@/lib/contexto";
import { fmtData } from "@/lib/format";

const DIA = 86400000;

export default async function Garantias({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string }> }) {
  const { aba, q } = await searchParams;
  const { supabase } = await getContexto();
  const [{ data: os }, { data: termos }] = await Promise.all([
    supabase
      .from("service_orders")
      .select("id, number, termo, warranty, closed_at, status, clients(name), equipment(code, brand, model)")
      .eq("warranty", true)
      .in("status", ["concluido", "faturado", "finalizado"])
      .not("closed_at", "is", null)
      .order("closed_at", { ascending: false })
      .limit(1000),
    supabase.from("warranty_terms").select("name, days"),
  ]);
  const dias = new Map<string, number>();
  for (const t of termos ?? []) if ((t as any).days) dias.set(String((t as any).name).toLowerCase(), Number((t as any).days));
  const agora = Date.now();
  const linhas = (os ?? [])
    .map((o: any) => {
      const d = dias.get(String(o.termo ?? "").toLowerCase());
      if (!d) return null;
      const vence = new Date(new Date(o.closed_at).getTime() + d * DIA);
      const restam = Math.ceil((vence.getTime() - agora) / DIA);
      return { o, d, vence, restam };
    })
    .filter(Boolean) as { o: any; d: number; vence: Date; restam: number }[];
  const vigentes = linhas.filter((l) => l.restam >= 0);
  const expiradas = linhas.filter((l) => l.restam < 0);
  const t = (q ?? "").trim().toLowerCase();
  const filtra = (l: { o: any }) =>
    !t || [String(l.o.number), l.o.clients?.name, l.o.equipment?.code, l.o.equipment?.model].filter(Boolean).some((x: string) => x.toLowerCase().includes(t));
  const aba2 = aba === "expiradas" ? "expiradas" : "vigentes";
  const lista = (aba2 === "vigentes" ? vigentes : expiradas).filter(filtra);

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="title">Garantias</h1>
          <div className="muted">OS e vendas em garantia e as que venceram, com os dias que faltam</div>
        </div>
        <Link className="btn secondary" href="/garantias/termos">Termos de garantia</Link>
      </div>
      <nav className="os-sub" style={{ marginBottom: 12 }}>
        <Link href="/garantias" className={aba2 === "vigentes" ? "ativa" : ""}>OS em garantia <span className="os-cont">{vigentes.length}</span></Link>
        <Link href="/garantias?aba=expiradas" className={aba2 === "expiradas" ? "ativa" : ""}>OS expiradas <span className="os-cont">{expiradas.length}</span></Link>
      </nav>
      <form className="card" style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        {aba && <input type="hidden" name="aba" value={aba} />}
        <input name="q" defaultValue={q ?? ""} placeholder="Buscar por OS, cliente ou equipamento" style={{ flex: 1 }} />
        <button className="btn secondary">Buscar</button>
      </form>
      <section className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead><tr><th>OS #</th><th>Cliente</th><th>Equipamento</th><th>Finalizada em</th><th>Garantia</th><th>Vence em</th><th>Dias restantes</th><th>Status</th></tr></thead>
          <tbody>
            {lista.map((l) => (
              <tr key={l.o.id}>
                <td><Link href={`/os/${l.o.id}`} style={{ color: "var(--link)", fontWeight: 800 }}>#{l.o.number}</Link></td>
                <td>{l.o.clients?.name ?? "—"}</td>
                <td>{l.o.equipment ? `${l.o.equipment.code} · ${l.o.equipment.brand ?? ""} ${l.o.equipment.model ?? ""}` : "—"}</td>
                <td>{fmtData(l.o.closed_at)}</td>
                <td>{l.o.termo} ({l.d} dias)</td>
                <td>{fmtData(l.vence.toISOString())}</td>
                <td>{Math.max(l.restam, 0)}</td>
                <td><span className="badge" style={{ background: l.restam >= 0 ? "#dcfce7" : "#fee2e2" }}>{l.restam >= 0 ? "Em garantia" : "Expirada"}</span></td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={8} className="muted" style={{ textAlign: "center" }}>Nenhuma OS {aba2 === "vigentes" ? "em garantia no momento" : "com garantia expirada"}. Para aparecer aqui, a OS precisa estar marcada com garantia, concluída e com um termo que tenha prazo em dias.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
