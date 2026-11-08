import Link from "next/link";
import { getContexto } from "@/lib/contexto";

const NOMES: Record<string, string> = {
  tarefas: "Tarefas", kits: "Kits", movimentacao: "Movimentação de estoque", "consumo-interno": "Consumo interno",
  grupos: "Grupos de produtos", "listas-de-precos": "Listas de preços", compras: "Compras", orcamentos: "Orçamentos",
  garantias: "Garantias", vendas: "Vendas", transferencias: "Transferências", extratos: "Extratos", dre: "DRE",
  metricas: "Métricas", comissoes: "Comissões", "notas-fiscais": "Notas fiscais", relatorios: "Relatórios",
  emitente: "Emitente e filiais", termos: "Termos de garantia", checklist: "Checklist", tags: "Tags",
  parametros: "Parâmetros", "painel-de-gestao": "Painel de gestão",
};

export default async function Modulo({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await getContexto();
  const nome = NOMES[slug] ?? slug;
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
