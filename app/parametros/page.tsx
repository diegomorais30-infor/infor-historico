import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { lerConfig, PADROES } from "@/lib/config";

const ABAS: [string, string][] = [["mensagens", "Mensagens"], ["os", "Ordens de Serviço"], ["tarefas", "Tarefas"], ["orcamento", "Orçamento Express"]];
const CAMPOS: Record<string, string[]> = {
  mensagens: ["msg_cliente", "msg_os_criada", "msg_os_status", "msg_os_visualizar", "msg_os_completa", "msg_venda"],
  os: ["garantia_automatica", "autorizacao_itens", "cliente_cria_os", "agrupar_valores", "exibir_descricao", "exibir_codigo", "prazo_os_dias"],
  tarefas: ["tarefa_pedido_compra", "tarefa_resposta_orcamento"],
  orcamento: ["orcamento_link_publico", "orcamento_agrupar", "orcamento_validade_dias", "msg_orcamento"],
};

async function salvar(fd: FormData) {
  "use server";
  const { perfil } = await getContexto();
  if (perfil?.role !== "admin") redirect("/parametros?erro=" + encodeURIComponent("Só o administrador altera os parâmetros."));
  const supabase = await createClient();
  const aba = String(fd.get("aba"));
  const atual = await lerConfig(supabase);
  const novo: Record<string, any> = { ...atual };
  for (const c of CAMPOS[aba] ?? []) {
    const padrao = (PADROES as any)[c];
    if (typeof padrao === "boolean") novo[c] = fd.get(c) === "on";
    else if (typeof padrao === "number") novo[c] = Math.max(0, Number(fd.get(c)) || 0);
    else novo[c] = String(fd.get(c) ?? "").slice(0, 1000);
  }
  const { error } = await supabase.from("company_settings").upsert({ data: novo });
  if (error) redirect(`/parametros?aba=${aba}&erro=` + encodeURIComponent(error.message));
  revalidatePath("/parametros");
  redirect(`/parametros?aba=${aba}&ok=1`);
}

const VARS_GERAIS = ["saudacao", "cliente", "emailCliente", "usuario"];
const VARS_OS = ["os", "status", "situacao", "link_acompanhamento", "equipamento"];

function Chave({ nome, titulo, desc, v }: { nome: string; titulo: string; desc: string; v: boolean }) {
  return (
    <label className="os-bloco" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8, cursor: "pointer" }}>
      <span><b>{titulo}</b><div className="muted" style={{ fontSize: 12 }}>{desc}</div></span>
      <input type="checkbox" name={nome} defaultChecked={v} style={{ width: 22, height: 22 }} />
    </label>
  );
}
function Msg({ nome, titulo, desc, v }: { nome: string; titulo: string; desc: string; v: string }) {
  return (
    <label className="field" style={{ marginBottom: 12 }}>
      <b>{titulo}</b><span className="muted" style={{ fontSize: 12 }}>{desc}</span>
      <textarea name={nome} rows={4} maxLength={1000} defaultValue={v} />
    </label>
  );
}

export default async function Parametros({ searchParams }: { searchParams: Promise<{ aba?: string; erro?: string; ok?: string }> }) {
  const { aba: a, erro, ok } = await searchParams;
  const aba = ABAS.some(([k]) => k === a) ? (a as string) : "mensagens";
  const { supabase, perfil } = await getContexto();
  const c = await lerConfig(supabase);
  const admin = perfil?.role === "admin";

  return (
    <main className="wrap">
      <h1 className="title">Parâmetros</h1>
      <div className="muted">Mensagens, regras da OS e as automações do sistema</div>
      <nav className="os-abas" style={{ marginTop: 12 }}>
        {ABAS.map(([k, n]) => <Link key={k} href={`/parametros?aba=${k}`} className={k === aba ? "ativa" : ""}>{n}</Link>)}
      </nav>
      <form action={salvar} className="card os-painel">
        <input type="hidden" name="aba" value={aba} />
        {erro && <div className="error" style={{ marginBottom: 10 }}>{erro}</div>}
        {ok && <div className="os-ok">Parâmetros salvos.</div>}
        {!admin && <div className="os-bloco" style={{ marginBottom: 10 }}>Somente o administrador pode alterar.</div>}

        {(aba === "mensagens" || aba === "orcamento") && (
          <div className="os-bloco" style={{ marginBottom: 14 }}>
            <b>Variáveis disponíveis</b> <span className="muted">(escreva entre chaves, ex.: {"{cliente}"})</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {[...VARS_GERAIS, ...(aba === "mensagens" ? [...VARS_OS, "venda"] : ["numero", "link", "validade"])].map((x) => <code key={x} className="os-tag" style={{ background: "#e2e8f0", color: "#334155" }}>{`{${x}}`}</code>)}
            </div>
          </div>
        )}

        {aba === "mensagens" && (
          <fieldset disabled={!admin} style={{ border: 0, padding: 0 }}>
            <h3>Mensagens para clientes</h3>
            <Msg nome="msg_cliente" titulo="Mensagem direta para o Cliente" desc="Enviada ao clicar no botão WhatsApp em Clientes." v={c.msg_cliente} />
            <h3>Mensagens de ordem de serviço</h3>
            <Msg nome="msg_os_criada" titulo="Mensagem ao criar uma OS" desc="Enviada ao cliente quando uma nova OS é criada." v={c.msg_os_criada} />
            <Msg nome="msg_os_status" titulo="Mensagem ao alterar status da OS" desc="Mensagem padrão ao mudar o status." v={c.msg_os_status} />
            <Msg nome="msg_os_visualizar" titulo="Mensagem em visualizar OS" desc="Enviada ao clicar no botão WhatsApp da OS." v={c.msg_os_visualizar} />
            <Msg nome="msg_os_completa" titulo="Mensagem para envio completo de OS" desc="Enviada ao enviar o PDF da OS." v={c.msg_os_completa} />
            <h3>Mensagens de venda</h3>
            <Msg nome="msg_venda" titulo="Mensagem para envio completo de Venda" desc="Enviada ao enviar o PDF da venda." v={c.msg_venda} />
          </fieldset>
        )}
        {aba === "os" && (
          <fieldset disabled={!admin} style={{ border: 0, padding: 0 }}>
            <Chave nome="garantia_automatica" titulo="Adicionar Garantia Automática" desc="Adiciona garantia e termo automaticamente ao concluir a OS." v={c.garantia_automatica} />
            <Chave nome="autorizacao_itens" titulo="Autorização para Produtos e Serviços" desc="Por padrão, informar que necessita de autorização ao adicionar itens." v={c.autorizacao_itens} />
            <Chave nome="cliente_cria_os" titulo="Cliente pode criar OS" desc="Permite que o cliente crie uma OS pelo portal do cliente." v={c.cliente_cria_os} />
            <Chave nome="agrupar_valores" titulo="Agrupar valores de Produto e Serviços" desc="Agrupa os valores em um único campo." v={c.agrupar_valores} />
            <Chave nome="exibir_descricao" titulo="Exibir descrição do produto/serviço" desc="Exibe a descrição nos itens da OS e da venda." v={c.exibir_descricao} />
            <Chave nome="exibir_codigo" titulo="Exibir código do produto/serviço" desc="Mostra o código do item nas impressões." v={c.exibir_codigo} />
            <label className="os-bloco" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <span><b>Prazo padrão da OS</b><div className="muted" style={{ fontSize: 12 }}>Preenchido automaticamente ao criar uma nova OS. Deixe 0 para não preencher.</div></span>
              <span><input name="prazo_os_dias" type="number" min={0} defaultValue={c.prazo_os_dias} style={{ width: 80 }} /> dias</span>
            </label>
          </fieldset>
        )}
        {aba === "tarefas" && (
          <fieldset disabled={!admin} style={{ border: 0, padding: 0 }}>
            <Chave nome="tarefa_pedido_compra" titulo="Gerar tarefa a cada novo Pedido de Compra" desc="Cria uma tarefa para repor itens com estoque abaixo do mínimo." v={c.tarefa_pedido_compra} />
            <Chave nome="tarefa_resposta_orcamento" titulo="Gerar tarefa quando o cliente responder" desc="Quando o cliente aprova ou recusa o orçamento pelo link, cria uma tarefa." v={c.tarefa_resposta_orcamento} />
          </fieldset>
        )}
        {aba === "orcamento" && (
          <fieldset disabled={!admin} style={{ border: 0, padding: 0 }}>
            <Chave nome="orcamento_link_publico" titulo="Link público de orçamentos" desc="O cliente vê e aprova o orçamento pelo link." v={c.orcamento_link_publico} />
            <Chave nome="orcamento_agrupar" titulo="Agrupar valores" desc="O cliente vê só o total de cada proposta." v={c.orcamento_agrupar} />
            <label className="os-bloco" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span><b>Validade padrão</b><div className="muted" style={{ fontSize: 12 }}>Dias de validade de um novo orçamento.</div></span>
              <span><input name="orcamento_validade_dias" type="number" min={1} defaultValue={c.orcamento_validade_dias} style={{ width: 80 }} /> dias</span>
            </label>
            <Msg nome="msg_orcamento" titulo="Mensagem de envio ao cliente" desc="Usada no botão «Enviar link» do orçamento (WhatsApp)." v={c.msg_orcamento} />
          </fieldset>
        )}
        {admin && <button className="btn primary">Salvar alterações</button>}
      </form>
    </main>
  );
}
