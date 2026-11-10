// Parâmetros do sistema (por empresa), com valores padrão iguais ao Inforos.
export const PADROES = {
  msg_cliente: "Olá *{cliente}*, tudo bem?",
  msg_os_criada: "Olá *{cliente}*,\n\nSua Ordem de Serviço #*{os}* foi aberta. Equipamento: {equipamento}.\n\nQualquer dúvida, entre em contato!",
  msg_os_status: "Olá *{cliente}*,\n\nAlteramos sua Ordem de Serviço #*{os}* para o Status *{status}*.\n\nQualquer dúvida, entre em contato!",
  msg_os_visualizar: "Novidades *{cliente}*,\n\nAtualizamos sua Ordem de Serviço #*{os}* para *{status}*.",
  msg_os_completa: "Olá *{cliente}*,\n\nEstamos enviando sua Ordem de Serviço #*{os}* com Status *{status}*.\n\nQualquer dúvida, entre em contato!",
  msg_venda: "Olá *{cliente}*,\n\nEstamos enviando sua Venda #*{venda}*.\n\nQualquer dúvida, entre em contato!",
  msg_orcamento: "Olá *{cliente}*! Segue seu orçamento nº {numero} para aprovação: {link}",
  garantia_automatica: false,
  autorizacao_itens: false,
  cliente_cria_os: false,
  agrupar_valores: false,
  exibir_descricao: false,
  exibir_codigo: false,
  prazo_os_dias: 0,
  tarefa_pedido_compra: false,
  tarefa_resposta_orcamento: false,
  orcamento_link_publico: true,
  orcamento_agrupar: false,
  orcamento_validade_dias: 7,
};
export type Config = typeof PADROES;

export async function lerConfig(supabase: any): Promise<Config> {
  const { data } = await supabase.from("company_settings").select("data").maybeSingle();
  return { ...PADROES, ...((data as any)?.data ?? {}) };
}

export function saudacao() {
  const h = Number(new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function preencher(modelo: string, v: Record<string, string | number | null | undefined>) {
  return modelo.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
}
