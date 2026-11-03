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
