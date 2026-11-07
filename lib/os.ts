export const STATUS_OS: Record<string, string> = {
  entrada: "Entrada",
  orcamento: "Orçamento",
  aberto: "Aberto",
  andamento: "Em andamento",
  pausado: "Pausado",
  concluido: "Concluído",
  faturado: "Faturado",
  cancelado: "Cancelado",
};

export const PRIORIDADE_OS: Record<string, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

// Sugestões de "situação" (campo livre; o usuário pode digitar outra)
export const SITUACOES_OS = [
  "Aguardando peça",
  "Aguardando aprovação do cliente",
  "Aguardando retirada",
  "Em teste",
  "Sem conserto",
  "Garantia",
];

export const COR_STATUS_OS: Record<string, string> = {
  entrada: "#78B8FF",
  orcamento: "#FFC800",
  aberto: "#2F7DE1",
  andamento: "#a58df0",
  pausado: "#ffb4b4",
  concluido: "#3fb583",
  faturado: "#3fb583",
  cancelado: "#92a3b3",
};
