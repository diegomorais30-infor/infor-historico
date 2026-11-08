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

// Cores como no Inforos: etapas em aberto em dourado, etapas encerradas em cinza.
export const COR_STATUS_OS: Record<string, string> = {
  entrada: "#c09853",
  orcamento: "#c09853",
  aberto: "#c09853",
  andamento: "#c09853",
  pausado: "#c09853",
  concluido: "#939da8",
  faturado: "#939da8",
  finalizado: "#939da8",
  cancelado: "#939da8",
};

// Selos coloridos iguais aos do Inforos: verde = ok, laranja = pendente, vermelho = atrasado/recusado.
export const COR_OK = "#468847";
export const COR_PENDENTE = "#f89406";
export const COR_ATRASO = "#f74d4d";

export function corSituacao(texto?: string | null) {
  const t = (texto ?? "").toLowerCase();
  if (/recus|sem conserto|cancel/.test(t)) return COR_ATRASO;
  if (/realiz|autoriz|aprov|conclu|retirad|pago/.test(t)) return COR_OK;
  if (t) return COR_PENDENTE;
  return "#6b7a8d";
}

export const COR_PRIORIDADE: Record<string, string> = { baixa: COR_OK, normal: COR_PENDENTE, alta: COR_ATRASO, urgente: COR_ATRASO };
export const ROTULO_PRIORIDADE: Record<string, string> = { baixa: "Baixa prioridade", normal: "Média prioridade", alta: "Alta prioridade", urgente: "Urgente" };
