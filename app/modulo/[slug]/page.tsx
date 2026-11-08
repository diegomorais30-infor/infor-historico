import { tudo } from "@/lib/paginar";
import Link from "next/link";
import { getContexto } from "@/lib/contexto";
import { podeVer } from "@/lib/permissoes";
import { fmtData, moeda } from "@/lib/format";

type Col = { t: string; f: (d: any) => string };
const LEGADO: Record<string, { modulo: string; ordem: string; cols: Col[] }> = {
  compras: { modulo: "compras", ordem: "dataCompra", cols: [
    { t: "Nº", f: (d) => "#" + d.idCompras }, { t: "Data", f: (d) => fmtData(d.dataCompra) }, { t: "Fornecedor", f: (d) => String(d.fornecedor ?? "") },
    { t: "Itens", f: (d) => String(d.qtd_produtos ?? "") }, { t: "Status", f: (d) => String(d.status ?? "") }, { t: "Total", f: (d) => moeda(Number(d.valorTotal)) },
  ] },
  garantias: { modulo: "garantias", ordem: "dataGarantia", cols: [
    { t: "Nº", f: (d) => "#" + d.idGarantias }, { t: "Referência", f: (d) => String(d.refGarantia ?? "") }, { t: "Prazo (dias)", f: (d) => String(d.prazo_garantia ?? "") }, { t: "Texto", f: (d) => String(d.textoGarantia ?? "").replace(/<[^>]+>/g, " ").slice(0, 300) },
  ] },
  termos: { modulo: "garantias", ordem: "dataGarantia", cols: [
    { t: "Nº", f: (d) => "#" + d.idGarantias }, { t: "Termo", f: (d) => String(d.refGarantia ?? "") }, { t: "Prazo (dias)", f: (d) => String(d.prazo_garantia ?? "") }, { t: "Texto", f: (d) => String(d.textoGarantia ?? "").replace(/<[^>]+>/g, " ").slice(0, 600) },
  ] },
  "historico-estoque": { modulo: "movimentacao", ordem: "data", cols: [
    { t: "Data", f: (d) => fmtData(d.data) }, { t: "Produto", f: (d) => String(d.produto ?? "") }, { t: "Origem", f: (d) => String(d.referencia ?? d.origem ?? "") },
    { t: "Cliente", f: (d) => String(d.cliente ?? "") }, { t: "Qtd", f: (d) => String(d.quantidade ?? "") }, { t: "Valor", f: (d) => moeda(Number(d.valorTotal)) },
  ] },
  "modelos-orcamento": { modulo: "orcamento_modelos", ordem: "idModelo", cols: [
    { t: "Nº", f: (d) => "#" + d.idModelo }, { t: "Modelo", f: (d) => String(d.nome ?? "") }, { t: "Texto", f: (d) => String(d.descricao ?? "").replace(/<[^>]+>/g, " ").slice(0, 800) },
  ] },
  orcamentos: { modulo: "orcamentos", ordem: "created_at", cols: [
    { t: "Nº", f: (d) => "#" + d.numero }, { t: "Data", f: (d) => fmtData(d.created_at) }, { t: "Cliente", f: (d) => String(d.cliente_display ?? d.nomeCliente ?? d.lead_nome ?? "") },
    { t: "Título", f: (d) => String(d.titulo ?? d.resumo ?? "") }, { t: "Status", f: (d) => String(d.status ?? "") }, { t: "Total", f: (d) => moeda(Number(d.valorTotal)) },
  ] },
};

const NOMES: Record<string, string> = {
  tarefas: "Tarefas", kits: "Kits", movimentacao: "Movimentação de estoque", "consumo-interno": "Consumo interno",
  grupos: "Grupos de produtos", "listas-de-precos": "Listas de preços", compras: "Compras", orcamentos: "Orçamentos",
  garantias: "Garantias", vendas: "Vendas", transferencias: "Transferências", extratos: "Extratos", dre: "DRE",
  metricas: "Métricas", comissoes: "Comissões", "notas-fiscais": "Notas fiscais", relatorios: "Relatórios",
  emitente: "Emitente e filiais", termos: "Termos de garantia", checklist: "Checklist", tags: "Tags",
  "historico-estoque": "Histórico de movimentação (Inforos)", "modelos-orcamento": "Modelos de orçamento", parametros: "Parâmetros", "painel-de-gestao": "Painel de gestão",
};

export default async function Modulo({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, perfil } = await getContexto();
  const nome = NOMES[slug] ?? slug;
  const cfg = LEGADO[slug];
  if (cfg && podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro")) {
    const data = await tudo(() => supabase.from("legacy_records").select("id, data").eq("module", cfg.modulo).order("id"));
    const linhas = (data ?? []).map((r: any) => r.data).sort((a: any, b: any) => String(b[cfg.ordem] ?? "").localeCompare(String(a[cfg.ordem] ?? "")));
    return (
      <main className="wrap">
        <h1 className="title">{nome}</h1>
        <p className="muted">{linhas.length} registro(s) migrados do Inforos. A tela de edição ainda está em construção.</p>
        <div className="card" style={{ overflowX: "auto" }}>
          <table>
            <thead><tr>{cfg.cols.map((c) => <th key={c.t}>{c.t}</th>)}</tr></thead>
            <tbody>
              {linhas.map((d: any, i: number) => (
                <tr key={i}>{cfg.cols.map((c) => <td key={c.t}>{c.f(d)}</td>)}</tr>
              ))}
              {!linhas.length && <tr><td colSpan={cfg.cols.length} className="muted">Nada migrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    );
  }
  return (
    <main className="wrap" style={{ maxWidth: 800 }}>
      <h1 className="title">{nome}</h1>
      <section className="card" style={{ marginTop: 14 }}>
        <p>Este módulo faz parte do menu do Inforos e está sendo reproduzido no InforGest, com os dados migrados.</p>
        <p className="muted">Em construção — entra nas próximas etapas.</p>
        <Link href="/dashboard" className="btn secondary">← Início</Link>
      </section>
    </main>
  );
}
