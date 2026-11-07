export const STATUS_OS: Record<string, string> = {
  entrada: "Entrada",
  orcamento: "Orçamento",
  aberto: "Aberto",
  andamento: "Em andamento",
  pausado: "Pausado",
  concluido: "Concluído",
  faturado: "Faturado",
  finalizado: "Finalizado",
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
  "Enviar p/ cliente",
  "Aguardando resposta do cliente",
  "Comprar peça",
  "Aguardando peça",
  "Testes finais",
  "Postar nos Correios",
  "Aguardando retirada",
  "Sem conserto",
];

// Fluxo principal da OS (barra de progresso) e quem cuida de cada etapa
export const FLUXO_OS = ["entrada", "orcamento", "aberto", "andamento", "pausado", "concluido", "faturado", "finalizado"];
export const RESPONSAVEL_ETAPA: Record<string, string> = {
  entrada: "Atendente",
  orcamento: "Atendente",
  aberto: "Atendente",
  andamento: "Técnico",
  pausado: "Técnico",
  concluido: "Técnico",
  faturado: "Financeiro",
  finalizado: "Financeiro",
};
export function progressoOS(status: string) {
  const i = FLUXO_OS.indexOf(status);
  return i < 0 ? 0 : Math.round(((i + 1) / FLUXO_OS.length) * 100);
}

export const COR_STATUS_OS: Record<string, string> = {
  entrada: "#78B8FF",
  orcamento: "#FFC800",
  aberto: "#2F7DE1",
  andamento: "#a58df0",
  pausado: "#ffb4b4",
  concluido: "#3fb583",
  faturado: "#3fb583",
  finalizado: "#3fb583",
  cancelado: "#92a3b3",
};
