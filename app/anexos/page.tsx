import { redirect } from "next/navigation";
import { getContexto } from "@/lib/contexto";

const LIMITE = 10 * 1024 * 1024 * 1024; // 10 GB (plano de referência do Inforos)
const mb = (b: number) => (b >= 1024 ** 3 ? (b / 1024 ** 3).toFixed(2) + " GB" : (b / 1024 ** 2).toFixed(2) + " MB");
const NOMES: Record<string, string> = { "os-anexos": "Anexos de OS (fotos e arquivos)" };

export default async function Anexos() {
  const { supabase, perfil } = await getContexto();
  if (perfil?.role !== "admin") redirect("/dashboard");
  const { data } = await supabase.rpc("storage_usage");
  const linhas: any[] = (data ?? []) as any[];
  const total = linhas.reduce((s, l) => s + Number(l.bytes), 0);
  const arqs = linhas.reduce((s, l) => s + Number(l.arquivos), 0);
  const { count: os } = await supabase.from("os_attachments").select("order_id", { count: "exact", head: true });
  const pct = Math.min((total / LIMITE) * 100, 100);
  return (
    <main className="wrap" style={{ maxWidth: 800 }}>
      <h1 className="title">Anexos</h1>
      <p className="muted">Uso do armazenamento de arquivos da empresa.</p>
      <section className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <b style={{ fontSize: 22 }}>{mb(total)} <span className="muted" style={{ fontSize: 14 }}>de {mb(LIMITE)}</span></b>
          <span className="muted">{arqs} arquivos · {os ?? 0} anexos ligados a OS</span>
        </div>
        <div style={{ background: "#e5e7eb", borderRadius: 8, height: 12, marginTop: 10, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, background: pct > 85 ? "#dc2626" : "#2563eb", height: "100%" }} />
        </div>
      </section>
      <section className="card" style={{ marginTop: 12, overflowX: "auto" }}>
        <table className="table">
          <thead><tr><th>Origem</th><th>Arquivos</th><th>Tamanho</th></tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.bucket}><td>{NOMES[l.bucket] ?? l.bucket}</td><td>{Number(l.arquivos)}</td><td>{mb(Number(l.bytes))}</td></tr>
            ))}
            {!linhas.length && <tr><td colSpan={3} className="muted">Nenhum arquivo ainda.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
