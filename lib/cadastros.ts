export type Campo = { nome: string; rotulo: string; tipo: "text" | "textarea" | "number" | "date" | "parte" | "select"; opcoes?: string[]; obrigatorio?: boolean };
export type Cadastro = { slug: string; tabela: string; titulo: string; ajuda: string; area: "os" | "pecas" | "financeiro"; campos: Campo[]; colunas: string[]; ordem: string; desc?: boolean };

export const CADASTROS: Record<string, Cadastro> = {
  tarefas: { slug: "tarefas", tabela: "tasks", titulo: "Tarefas", ajuda: "Lembretes e pendências da equipe.", area: "os", ordem: "due_date",
    campos: [{ nome: "title", rotulo: "Tarefa", tipo: "text", obrigatorio: true }, { nome: "description", rotulo: "Detalhes", tipo: "textarea" }, { nome: "due_date", rotulo: "Prazo", tipo: "date" }], colunas: ["title", "description", "due_date", "done"] },
  tags: { slug: "tags", tabela: "tags", titulo: "Tags", ajuda: "Etiquetas para organizar registros.", area: "os", ordem: "name",
    campos: [{ nome: "name", rotulo: "Nome", tipo: "text", obrigatorio: true }], colunas: ["name"] },
  checklist: { slug: "checklist", tabela: "checklist_items", titulo: "Checklist", ajuda: "Itens a conferir na entrada e na saída do equipamento.", area: "os", ordem: "name",
    campos: [{ nome: "name", rotulo: "Item", tipo: "text", obrigatorio: true }], colunas: ["name", "active"] },
  grupos: { slug: "grupos", tabela: "part_groups", titulo: "Grupos de produtos", ajuda: "Grupos para classificar produtos e peças.", area: "pecas", ordem: "name",
    campos: [{ nome: "name", rotulo: "Nome", tipo: "text", obrigatorio: true }], colunas: ["name"] },
  "listas-de-precos": { slug: "listas-de-precos", tabela: "price_lists", titulo: "Listas de preços", ajuda: "Tabelas de preço com ajuste percentual sobre o preço padrão.", area: "pecas", ordem: "name",
    campos: [{ nome: "name", rotulo: "Nome", tipo: "text", obrigatorio: true }, { nome: "adjust_percent", rotulo: "Ajuste (%)", tipo: "number" }], colunas: ["name", "adjust_percent"] },
  kits: { slug: "kits", tabela: "kits", titulo: "Kits", ajuda: "Conjuntos de produtos vendidos juntos.", area: "pecas", ordem: "name",
    campos: [{ nome: "name", rotulo: "Nome do kit", tipo: "text", obrigatorio: true }, { nome: "items_text", rotulo: "Itens do kit (um por linha)", tipo: "textarea" }], colunas: ["name", "items_text"] },
  transferencias: { slug: "transferencias", tabela: "transfers", titulo: "Transferências", ajuda: "Movimentos entre contas (caixa, banco, cartão).", area: "financeiro", ordem: "transfer_date", desc: true,
    campos: [{ nome: "from_account", rotulo: "Conta de origem", tipo: "text", obrigatorio: true }, { nome: "to_account", rotulo: "Conta de destino", tipo: "text", obrigatorio: true }, { nome: "amount", rotulo: "Valor", tipo: "number", obrigatorio: true }, { nome: "transfer_date", rotulo: "Data", tipo: "date" }, { nome: "notes", rotulo: "Observações", tipo: "text" }], colunas: ["transfer_date", "from_account", "to_account", "amount", "notes"] },
  movimentacao: { slug: "movimentacao", tabela: "stock_movements", titulo: "Movimentação de estoque", ajuda: "Entradas, saídas e ajustes. O saldo do produto é atualizado na hora.", area: "pecas", ordem: "created_at", desc: true,
    campos: [{ nome: "part_id", rotulo: "Produto", tipo: "parte", obrigatorio: true }, { nome: "reason", rotulo: "Tipo", tipo: "select", opcoes: ["entrada", "saida", "ajuste", "consumo_interno"], obrigatorio: true }, { nome: "quantity", rotulo: "Quantidade", tipo: "number", obrigatorio: true }, { nome: "notes", rotulo: "Observações", tipo: "text" }], colunas: ["created_at", "part_id", "reason", "quantity", "notes"] },
  "consumo-interno": { slug: "consumo-interno", tabela: "stock_movements", titulo: "Consumo interno", ajuda: "Saída de produtos para uso da própria empresa.", area: "pecas", ordem: "created_at", desc: true,
    campos: [{ nome: "part_id", rotulo: "Produto", tipo: "parte", obrigatorio: true }, { nome: "quantity", rotulo: "Quantidade", tipo: "number", obrigatorio: true }, { nome: "notes", rotulo: "Observações", tipo: "text" }], colunas: ["created_at", "part_id", "quantity", "notes"] },
};
