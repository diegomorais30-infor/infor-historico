export const TIPOS_MANUTENCAO: Record<string, string> = {
  corrective: "Corretiva",
  preventive: "Preventiva",
  installation: "Instalação",
  inspection: "Inspeção",
  warranty: "Garantia",
};

export const STATUS_EQUIPAMENTO: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  maintenance: "Em manutenção",
  retired: "Baixado",
};

export const PERFIS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  technician: "Técnico",
};

// "2026-11-03" -> "03/11/2026"
export function fmtData(d?: string | null) {
  if (!d) return "—";
  const [ano, mes, dia] = d.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

// Campo de formulário vazio vira null (o banco rejeita "" em colunas de data).
export function vazioParaNulo<T extends Record<string, unknown>>(obj: T) {
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    saida[k] = typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v;
  }
  return saida;
}

export const STATUS_CONTRATO: Record<string, string> = {
  active: "Ativo",
  suspended: "Suspenso",
  ended: "Encerrado",
};

export const STATUS_FATURA: Record<string, string> = {
  open: "Em aberto",
  paid: "Paga",
  canceled: "Cancelada",
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function moeda(v: number | string | null | undefined) {
  return Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Data de hoje no fuso de Brasília, no formato AAAA-MM-DD
export function hojeBR() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

// "2026-11" ou "2026-11-01" -> "nov/2026"
export function mesRotulo(d: string) {
  const [ano, mes] = d.slice(0, 7).split("-");
  return `${MESES[Number(mes) - 1]}/${ano}`;
}

// Soma meses a um "AAAA-MM"
export function somaMes(ym: string, n: number) {
  const [a, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
