import Zap from "@/components/zap";
import AssinaturaOS from "@/components/assinatura-os";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";
import { fmtData, moeda } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { COR_PRIORIDADE, COR_STATUS_OS, corSituacao, FLUXO_OS, ROTULO_PRIORIDADE, PRIORIDADE_OS, progressoOS, RESPONSAVEL_ETAPA, SITUACOES_OS, STATUS_OS } from "@/lib/os";
import { podeEditar, podeVer } from "@/lib/permissoes";
import { lerConfig, preencher, saudacao } from "@/lib/config";


const ABAS: [string, string][] = [
  ["detalhes", "Detalhes da OS"],
  ["equipamentos", "Equipamentos"],
  ["checklists", "Checklists"],
  ["itens", "Produtos / Serviços"],
  ["tarefas", "Tarefas"],
  ["anexos", "Anexos"],
  ["assinatura", "Assinatura"],
  ["logs", "Logs"],
];
const ETAPAS: { k: string; n: string; g: string }[] = [
  { k: "entrada", n: "Entrada", g: "Atendente" },
  { k: "orcamento", n: "Orçamento", g: "Atendente" },
  { k: "aberto", n: "Aberto", g: "Atendente" },
  { k: "andamento", n: "Andamento", g: "Técnico" },
  { k: "concluido", n: "Concluído", g: "Técnico" },
  { k: "faturado", n: "Faturado", g: "Financeiro" },
  { k: "finalizado", n: "Finalizado", g: "Financeiro" },
];

function voltar(id: string, aba: string, extra = "") {
  return `/os/${id}?aba=${aba || "detalhes"}${extra}`;
}

async function registrar(supabase: any, order_id: string, text: string) {
  const { data: u } = await supabase.auth.getUser();
  let nome: string | null = null;
  if (u?.user?.id) {
    const { data: pf } = await supabase.from("profiles").select("full_name").eq("id", u.user.id).maybeSingle();
    nome = pf?.full_name ?? u.user.email ?? null;
  }
  await supabase.from("os_logs").insert({ order_id, user_name: nome, text });
}

async function adicionarTag(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const tag = String(formData.get("tag") || "").trim();
  if (tag) {
    const { data: o } = await supabase.from("service_orders").select("tags").eq("id", id).single();
    const tags: string[] = (o as any)?.tags ?? [];
    if (!tags.includes(tag)) await supabase.from("service_orders").update({ tags: [...tags, tag] }).eq("id", id);
    await registrar(supabase, id, `Tag <b>${tag}</b> adicionada`);
  }
  revalidatePath(`/os/${id}`);
  redirect(voltar(id, "detalhes"));
}

async function removerTag(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const tag = String(formData.get("tag"));
  const { data: o } = await supabase.from("service_orders").select("tags").eq("id", id).single();
  await supabase.from("service_orders").update({ tags: ((o as any)?.tags ?? []).filter((t: string) => t !== tag) }).eq("id", id);
  revalidatePath(`/os/${id}`);
  redirect(voltar(id, "detalhes"));
}

async function vincularEquipamento(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  const equipment_id = String(formData.get("equipment_id") || "");
  if (equipment_id) {
    await supabase.from("os_equipment").upsert({ order_id, equipment_id }, { onConflict: "order_id,equipment_id", ignoreDuplicates: true });
    const { data: os } = await supabase.from("service_orders").select("equipment_id").eq("id", order_id).single();
    if (!(os as any)?.equipment_id) await supabase.from("service_orders").update({ equipment_id }).eq("id", order_id);
    await registrar(supabase, order_id, "Equipamento vinculado à OS");
  }
  revalidatePath(`/os/${order_id}`);
  redirect(voltar(order_id, "equipamentos"));
}

async function desvincularEquipamento(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  const equipment_id = String(formData.get("equipment_id"));
  await supabase.from("os_equipment").delete().eq("order_id", order_id).eq("equipment_id", equipment_id);
  const { data: os } = await supabase.from("service_orders").select("equipment_id").eq("id", order_id).single();
  if ((os as any)?.equipment_id === equipment_id) {
    const { data: outro } = await supabase.from("os_equipment").select("equipment_id").eq("order_id", order_id).limit(1);
    await supabase.from("service_orders").update({ equipment_id: (outro as any)?.[0]?.equipment_id ?? null }).eq("id", order_id);
  }
  await registrar(supabase, order_id, "Equipamento removido da OS");
  revalidatePath(`/os/${order_id}`);
  redirect(voltar(order_id, "equipamentos"));
}

async function salvarAcessorios(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { data: o } = await supabase.from("service_orders").select("acessorios").eq("id", id).single();
  let lista: string[] = (o as any)?.acessorios ?? [];
  const novo = String(formData.get("acessorio") || "").trim();
  const remover = String(formData.get("remover") || "");
  if (novo) lista = [...lista, novo];
  if (remover) lista = lista.filter((a) => a !== remover);
  await supabase.from("service_orders").update({ acessorios: lista }).eq("id", id);
  revalidatePath(`/os/${id}`);
  redirect(voltar(id, "equipamentos"));
}

async function adicionarChecklist(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  const { data: base } = await supabase.from("checklist_items").select("name").eq("active", true).order("name");
  const items = (base ?? []).map((b: any) => ({ name: b.name, v: "" }));
  if (!items.length) redirect(voltar(order_id, "checklists", "&erro=" + encodeURIComponent("Cadastre itens em Configurações > Checklist antes.")));
  await supabase.from("os_checklists").insert({ order_id, title: "Checklist de entrada", items });
  await registrar(supabase, order_id, "Checklist adicionado");
  revalidatePath(`/os/${order_id}`);
  redirect(voltar(order_id, "checklists"));
}

async function salvarChecklist(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  const id = String(formData.get("id"));
  const reiniciar = formData.get("reiniciar") === "1";
  const { data: c } = await supabase.from("os_checklists").select("items").eq("id", id).single();
  const items = ((c as any)?.items ?? []).map((it: any, i: number) => ({ name: it.name, v: reiniciar ? "" : String(formData.get(`item_${i}`) || "") }));
  await supabase.from("os_checklists").update({ items }).eq("id", id);
  await registrar(supabase, order_id, reiniciar ? "Checklist reiniciado" : "Checklist atualizado");
  revalidatePath(`/os/${order_id}`);
  redirect(voltar(order_id, "checklists"));
}

async function removerChecklist(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  await supabase.from("os_checklists").delete().eq("id", String(formData.get("id")));
  await registrar(supabase, order_id, "Checklist removido");
  revalidatePath(`/os/${order_id}`);
  redirect(voltar(order_id, "checklists"));
}

async function novaTarefa(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  const title = String(formData.get("title") || "").trim();
  const assignee_id = String(formData.get("assignee_id") || "") || null;
  if (title) {
    await supabase.from("os_tasks").insert({ order_id, title, assignee_id });
    await registrar(supabase, order_id, `Tarefa criada: ${title}`);
  }
  revalidatePath(`/os/${order_id}`);
  redirect(voltar(order_id, "tarefas"));
}

async function alternarTarefa(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  await supabase.from("os_tasks").update({ done: formData.get("done") === "1" }).eq("id", String(formData.get("id")));
  revalidatePath(`/os/${order_id}`);
  redirect(voltar(order_id, "tarefas"));
}

async function excluirTarefa(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  await supabase.from("os_tasks").delete().eq("id", String(formData.get("id")));
  revalidatePath(`/os/${order_id}`);
  redirect(voltar(order_id, "tarefas"));
}

async function enviarAnexo(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  const grupo = String(formData.get("grupo") || "antes");
  const arquivos = formData.getAll("arquivo").filter((f): f is File => f instanceof File && f.size > 0);
  const { data: os } = await supabase.from("service_orders").select("company_id").eq("id", order_id).single();
  if (!os || !arquivos.length) redirect(voltar(order_id, "anexos", "&erro=" + encodeURIComponent("Escolha um arquivo.")));
  const adm = createAdminClient();
  for (const f of arquivos) {
    if (f.size > 8 * 1024 * 1024) redirect(voltar(order_id, "anexos", "&erro=" + encodeURIComponent("Arquivo maior que 8 MB.")));
    const nome = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${(os as any).company_id}/${order_id}/${Date.now()}-${nome}`;
    const { error: e1 } = await adm.storage.from("os-anexos").upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type || "application/octet-stream" });
    if (e1) redirect(voltar(order_id, "anexos", "&erro=" + encodeURIComponent(e1.message)));
    await supabase.from("os_attachments").insert({ order_id, company_id: (os as any).company_id, grupo, path, legacy_name: f.name });
  }
  await registrar(supabase, order_id, `Anexo(s) adicionado(s) em ${grupo}`);
  revalidatePath(`/os/${order_id}`);
  redirect(voltar(order_id, "anexos"));
}

async function removerAnexo(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  const { data: a } = await supabase.from("os_attachments").select("path").eq("id", String(formData.get("id"))).single();
  if (a) {
    await createAdminClient().storage.from("os-anexos").remove([(a as any).path]);
    await supabase.from("os_attachments").delete().eq("id", String(formData.get("id")));
  }
  revalidatePath(`/os/${order_id}`);
  redirect(voltar(order_id, "anexos"));
}

async function salvarAssinatura(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  const data = String(formData.get("data") || "");
  if (data.startsWith("data:image/png;base64,") && data.length < 400000) {
    await supabase.from("service_orders").update({ signature_data: data, signature_at: new Date().toISOString() }).eq("id", order_id);
    await registrar(supabase, order_id, "OS assinada pelo cliente");
  }
  revalidatePath(`/os/${order_id}`);
  redirect(voltar(order_id, "assinatura"));
}

async function limparAssinatura(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  await supabase.from("service_orders").update({ signature_data: null, signature_at: null }).eq("id", order_id);
  await registrar(supabase, order_id, "Assinatura removida");
  revalidatePath(`/os/${order_id}`);
  redirect(voltar(order_id, "assinatura"));
}

async function salvar(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const priority = String(formData.get("priority"));
  const texto = (k: string) => String(formData.get(k) || "").trim() || null;
  const { data: antes } = await supabase.from("service_orders").select("status, situacao").eq("id", id).single();
  const { error } = await supabase
    .from("service_orders")
    .update({
      status,
      priority,
      warranty: formData.get("warranty") === "sim",
      situacao: texto("situacao"),
      deadline: texto("deadline"),
      technician_id: texto("technician_id"),
      report: texto("report"),
      defect: texto("defect"),
      quote_text: texto("quote_text"),
      contact_name: texto("contact_name"),
      external_invoice_number: texto("external_invoice_number"),
      origem: texto("origem"),
      termo: texto("termo"),
      tipo_os: texto("tipo_os"),
      filial: texto("filial"),
      observacoes: texto("observacoes"),
      ...(texto("atendente_id") ? { created_by: texto("atendente_id") } : {}),
    })
    .eq("id", id);
  if (error) redirect(`/os/${id}?erro=` + encodeURIComponent(error.message));
  const a: any = antes ?? {};
  if (a.status && a.status !== status) await registrar(supabase, id, `Status alterado de <b>${STATUS_OS[a.status] ?? a.status}</b> para <b>${STATUS_OS[status] ?? status}</b>`);
  const sit = texto("situacao");
  if ((a.situacao ?? null) !== sit) await registrar(supabase, id, `Situação alterada de <b>${a.situacao ?? "—"}</b> para <b>${sit ?? "—"}</b>`);
  revalidatePath(`/os/${id}`);
  redirect(`/os/${id}?aba=detalhes&ok=1`);
}

async function adicionarItem(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  const description = String(formData.get("description") || "").trim();
  const kind = String(formData.get("kind") || "servico");
  const quantity = Number(String(formData.get("quantity") || "1").replace(",", ".")) || 1;
  const part_id = String(formData.get("part_id") || "") || null;
  const service_id = String(formData.get("service_id") || "") || null;
  if (!description && !part_id && !service_id) redirect(`/os/${order_id}?aba=itens&erro=` + encodeURIComponent("Descreva o serviço ou escolha a peça."));
  let desc = description;
  if (kind === "servico" && service_id && !desc) {
    const { data: sv } = await supabase.from("catalog_services").select("name").eq("id", service_id).single();
    desc = (sv as any)?.name ?? "Serviço";
  }
  if (part_id && !desc) {
    const { data: p } = await supabase.from("parts").select("name").eq("id", part_id).single();
    desc = (p as any)?.name ?? "Peça";
  }
  const { error } = await supabase
    .from("service_order_items")
    .insert({ order_id, kind, description: desc, quantity, part_id: kind === "peca" ? part_id : null, service_id: kind === "servico" ? service_id : null });
  if (error) redirect(`/os/${order_id}?aba=itens&erro=` + encodeURIComponent(error.message));
  revalidatePath(`/os/${order_id}`);
  redirect(`/os/${order_id}?aba=itens`);
}

async function salvarFinanceiro(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  const num = (k: string) => Number(String(formData.get(k) || "0").replace(",", ".")) || 0;
  const { error } = await supabase.from("order_finance").upsert(
    {
      order_id,
      discount: num("discount"),
      advance: num("advance"),
      payment_method: String(formData.get("payment_method") || "").trim() || null,
      due_date: String(formData.get("due_date") || "") || null,
    },
    { onConflict: "order_id" }
  );
  if (error) redirect(`/os/${order_id}?aba=itens&erro=` + encodeURIComponent(error.message));
  // preços unitários editados
  for (const [k, v] of formData.entries()) {
    if (!k.startsWith("preco_")) continue;
    const item_id = k.slice(6);
    const unit_price = Number(String(v || "0").replace(",", ".")) || 0;
    await supabase.from("item_prices").upsert({ item_id, unit_price }, { onConflict: "item_id" });
  }
  revalidatePath(`/os/${order_id}`);
  redirect(`/os/${order_id}?aba=itens&ok=1`);
}

async function faturar(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  const { data: os } = await supabase.from("service_orders").select("number, client_id, status, clients(name)").eq("id", order_id).single();
  if (!os) redirect(`/os/${order_id}?aba=itens&erro=` + encodeURIComponent("OS não encontrada."));
  const o: any = os;
  if (!["concluido", "faturado"].includes(o.status))
    redirect(`/os/${order_id}?aba=itens&erro=` + encodeURIComponent("Conclua a OS antes de faturar."));
  const [{ data: itens }, { data: precos }, { data: fin }] = await Promise.all([
    supabase.from("service_order_items").select("id, quantity").eq("order_id", order_id),
    supabase.from("item_prices").select("item_id, unit_price"),
    supabase.from("order_finance").select("*").eq("order_id", order_id).maybeSingle(),
  ]);
  const mapa: Record<string, number> = {};
  for (const r of precos ?? []) mapa[(r as any).item_id] = Number((r as any).unit_price);
  const subtotal = (itens ?? []).reduce((t: number, i: any) => t + Number(i.quantity) * (mapa[i.id] ?? 0), 0);
  const f: any = fin ?? {};
  const total = Math.max(subtotal - Number(f.discount ?? 0), 0);
  const adiant = Math.min(Number(f.advance ?? 0), total);
  const resto = total - adiant;
  if (total <= 0) redirect(`/os/${order_id}?aba=itens&erro=` + encodeURIComponent("Lance os valores da OS antes de faturar."));
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const base = {
    kind: "receita",
    category: "Ordem de Serviço",
    party: o.clients?.name ?? null,
    client_id: o.client_id,
    order_id,
    payment_method: f.payment_method ?? null,
    competence: hoje,
  };
  if (resto > 0) {
    const { error } = await supabase.from("finance_entries").upsert(
      { ...base, origin: "os_fatura", description: `OS #${o.number} · fatura`, amount: resto, due_date: f.due_date ?? hoje },
      { onConflict: "order_id,origin", ignoreDuplicates: true }
    );
    if (error) redirect(`/os/${order_id}?aba=itens&erro=` + encodeURIComponent(error.message));
  }
  if (adiant > 0) {
    await supabase.from("finance_entries").upsert(
      { ...base, origin: "os_adiantamento", description: `OS #${o.number} · adiantamento`, amount: adiant, due_date: hoje, paid_at: hoje },
      { onConflict: "order_id,origin", ignoreDuplicates: true }
    );
  }
  await supabase.from("service_orders").update({ status: "faturado" }).eq("id", order_id);
  revalidatePath(`/os/${order_id}`);
  redirect(`/os/${order_id}?aba=itens&ok=1`);
}

async function adicionarAtividade(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  const texto = String(formData.get("texto") || "").trim().replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" } as any)[c]);
  if (!texto) redirect(voltar(order_id, "logs", "&erro=" + encodeURIComponent("Insira um texto descrevendo a atividade.")));
  await registrar(supabase, order_id, texto);
  revalidatePath(`/os/${order_id}`);
  redirect(voltar(order_id, "logs"));
}

async function custoInterno(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  const valor = Number(String(formData.get("amount") || "0").replace(",", ".")) || 0;
  if (valor <= 0) redirect(voltar(order_id, "itens", "&erro=" + encodeURIComponent("Informe o valor do custo.")));
  const { data: os } = await supabase.from("service_orders").select("number").eq("id", order_id).single();
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const pago = formData.get("pago") === "on";
  const desc = String(formData.get("description") || "").trim() || `Custo OS - #${(os as any)?.number}`;
  const { error } = await supabase.from("finance_entries").insert({
    kind: "despesa",
    category: String(formData.get("category") || "").trim() || "Custos",
    description: desc,
    party: String(formData.get("party") || "").trim() || null,
    order_id,
    origin: `os_custo:${crypto.randomUUID()}`,
    amount: valor,
    competence: hoje,
    due_date: String(formData.get("due_date") || "") || hoje,
    paid_at: pago ? hoje : null,
    notes: String(formData.get("notes") || "").trim() || null,
  });
  if (error) redirect(voltar(order_id, "itens", "&erro=" + encodeURIComponent(error.message)));
  await registrar(supabase, order_id, `Custo interno lançado: <b>${desc}</b>`);
  revalidatePath(`/os/${order_id}`);
  redirect(voltar(order_id, "itens"));
}

async function removerCusto(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  await supabase.from("finance_entries").delete().eq("id", String(formData.get("id"))).eq("order_id", order_id).like("origin", "os_custo:%");
  revalidatePath(`/os/${order_id}`);
  redirect(voltar(order_id, "itens"));
}

async function enviarAprovacao(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  const refazer = formData.get("refazer") === "1";
  const upd: any = { approval_status: "pendente" };
  if (refazer) Object.assign(upd, { approval_at: null, approval_name: null, approval_signature: null, approval_note: null });
  const { error } = await supabase.from("service_orders").update(upd).eq("id", order_id);
  if (error) redirect(`/os/${order_id}?aba=detalhes&erro=` + encodeURIComponent(error.message));
  revalidatePath(`/os/${order_id}`);
  redirect(`/os/${order_id}?aba=detalhes`);
}

async function removerItem(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const order_id = String(formData.get("order_id"));
  const { error } = await supabase.from("service_order_items").delete().eq("id", String(formData.get("id")));
  if (error) redirect(`/os/${order_id}?aba=itens&erro=` + encodeURIComponent(error.message));
  revalidatePath(`/os/${order_id}`);
  redirect(`/os/${order_id}?aba=itens`);
}

export default async function DetalheOS({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string; ok?: string; aba?: string; t?: string }>;
}) {
  const { id } = await params;
  const { erro, ok, aba: abaQ, t } = await searchParams;
  const aba = ABAS.some(([k]) => k === abaQ) ? (abaQ as string) : "detalhes";
  const { supabase, perfil } = await getContexto();
  const editar = podeEditar(perfil?.role, (perfil as any)?.permissions, "os");

  const { data: os } = await supabase
    .from("service_orders")
    .select("*, clients(id, name, phone, mobile), equipment(id, code, brand, model, serial_number), service_requests(protocol)")
    .eq("id", id)
    .single();
  if (!os) notFound();
  const o: any = os;

  const perms = (perfil as any)?.permissions;
  const verFin = podeVer(perfil?.role, perms, "financeiro");
  const editFin = podeEditar(perfil?.role, perms, "financeiro");
  const [{ data: itens }, { data: equipe }, { data: pecas }, { data: servicos }, { data: logs }, { data: tarefas }, { data: checks }, { data: vinc }, { data: eqCliente }, { data: termosGar }, { data: filiais }] = await Promise.all([
    supabase.from("service_order_items").select("id, kind, description, quantity").eq("order_id", id).order("created_at"),
    supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name"),
    supabase.from("parts").select("id, name, code").eq("active", true).order("name"),
    supabase.from("catalog_services").select("id, name").eq("active", true).order("name"),
    supabase.from("os_logs").select("id, user_name, text, created_at").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("os_tasks").select("id, title, assignee_id, done, created_by, created_at").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("os_checklists").select("id, title, items").eq("order_id", id).order("created_at"),
    supabase.from("os_equipment").select("equipment_id").eq("order_id", id),
    supabase.from("equipment").select("id, code, brand, model, serial_number").eq("client_id", o.client_id).order("code"),
    supabase.from("warranty_terms").select("name").order("name"),
    supabase.from("branches").select("name").order("name"),
  ]);
  const precoItem: Record<string, number> = {};
  let fin: any = { discount: 0, advance: 0, payment_method: "", due_date: "" };
  let custos: any[] = [];
  if (verFin) {
    const { data: cs } = await supabase.from("finance_entries").select("id, description, party, amount, due_date, paid_at").eq("order_id", id).like("origin", "os_custo:%").order("created_at");
    custos = cs ?? [];
    const { data: ip } = await supabase.from("item_prices").select("item_id, unit_price");
    for (const r of ip ?? []) precoItem[(r as any).item_id] = Number((r as any).unit_price);
    const { data: of } = await supabase.from("order_finance").select("*").eq("order_id", id).maybeSingle();
    if (of) fin = of;
  }
  const { data: anexos } = await supabase.from("os_attachments").select("id, grupo, path, legacy_name").eq("order_id", id).order("path");
  const fotos: { id: string; url: string; grupo: string | null; nome: string }[] = [];
  if ((anexos ?? []).length) {
    const adm = createAdminClient();
    const { data: urls } = await adm.storage.from("os-anexos").createSignedUrls((anexos ?? []).map((a: any) => a.path), 3600);
    (urls ?? []).forEach((u: any, i: number) => u.signedUrl && fotos.push({ id: (anexos as any)[i].id, url: u.signedUrl, grupo: (anexos as any)[i].grupo, nome: (anexos as any)[i].legacy_name ?? "" }));
  }
  const subtotal = (itens ?? []).reduce((tt: number, i: any) => tt + Number(i.quantity) * (precoItem[i.id] ?? 0), 0);
  const total = Math.max(subtotal - Number(fin.discount ?? 0), 0);
  const aPagar = Math.max(total - Number(fin.advance ?? 0), 0);

  const cfg = await lerConfig(supabase);
  const msgStatus = preencher(cfg.msg_os_status, {
    cliente: o.clients?.name, os: o.number, status: STATUS_OS[o.status] ?? o.status, situacao: o.situacao ?? "", saudacao: saudacao(),
    equipamento: o.equipment ? `${o.equipment.brand ?? ""} ${o.equipment.model ?? ""}`.trim() : "",
    link_acompanhamento: o.approval_token ? `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://inforgest.com.br"}/orcamento/${o.approval_token}` : "",
  });
  const nomeDe = (uid?: string | null) => (equipe ?? []).find((p: any) => p.id === uid)?.full_name ?? "—";
  const progresso = progressoOS(o.status);
  const etapaAtual = o.status === "pausado" ? "andamento" : o.status;
  const idxAtual = ETAPAS.findIndex((e) => e.k === etapaAtual);
  const idsVinculados = new Set<string>([...(vinc ?? []).map((v: any) => v.equipment_id), ...(o.equipment?.id ? [o.equipment.id] : [])]);
  const eqVinculados = (eqCliente ?? []).filter((e: any) => idsVinculados.has(e.id));
  const eqLivres = (eqCliente ?? []).filter((e: any) => !idsVinculados.has(e.id));
  const meuId = (perfil as any)?.id;
  const minhas = t !== "todas";
  const listaTarefas = (tarefas ?? []).filter((x: any) => (minhas ? x.assignee_id === meuId || x.created_by === meuId : true));
  const pendentes = listaTarefas.filter((x: any) => !x.done);
  const concluidas = listaTarefas.filter((x: any) => x.done);
  const fmtDH = (d: string) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const grupos: [string, string][] = [["antes", "Antes"], ["durante", "Durante"], ["depois", "Depois"]];

  return (
    <main className="wrap">
      <div className="headrow" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="title">Editar OS</h1>
          <div className="muted">Detalhes, equipamentos, itens e o andamento da ordem de serviço</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {editar && (
            <form action={adicionarTag} style={{ display: "flex", gap: 4 }}>
              <input type="hidden" name="id" value={o.id} />
              <input name="tag" placeholder="Adicionar tag" style={{ width: 130 }} />
              <button className="btn secondary">+ Tag</button>
            </form>
          )}
          <Link className="btn secondary" href={o.approval_token ? `/orcamento/${o.approval_token}` : `/os/${o.id}?aba=detalhes#aprovacao`}>O.S Cliente</Link>
          <Link className="btn secondary" href={`/os/${o.id}/imprimir`}>Imprimir</Link>
          <Link className="btn secondary" href="/os">Voltar</Link>
        </div>
      </div>

      <nav className="os-abas">
        {ABAS.map(([k, n]) => (
          <Link key={k} href={`/os/${o.id}?aba=${k}`} className={k === aba ? "ativa" : ""}>
            {n}
            {k === "logs" && (logs ?? []).length > 0 && <span className="os-cont">{(logs ?? []).length}</span>}
            {k === "tarefas" && pendentes.length > 0 && <span className="os-cont">{pendentes.length}</span>}
          </Link>
        ))}
      </nav>

      <section className="card os-painel">
        {verFin && (
          <div className="os-chips">
            <span>Total <b>{moeda(total)}</b></span>
            <span>Adiantado <b style={{ color: "#16a34a" }}>{moeda(Number(fin.advance ?? 0))}</b></span>
            <span>A pagar <b style={{ color: "#2563eb" }}>{moeda(aPagar)}</b></span>
          </div>
        )}
        {erro && <div className="error" style={{ margin: "10px 0" }}>{erro}</div>}
        {ok && <div className="os-ok">Salvo.</div>}

        {aba === "detalhes" && (
          <>
            {o.status !== "cancelado" && (
              <div className="os-stepper">
                <div className="os-grupos">
                  <span style={{ flex: 3 }}>ATENDENTE</span>
                  <span style={{ flex: 2 }}>TÉCNICO</span>
                  <span style={{ flex: 2 }}>FINANCEIRO</span>
                </div>
                <div className="os-etapas">
                  {ETAPAS.map((e, i) => (
                    <div key={e.k} className={i <= idxAtual ? "feita" : ""}>{e.n}</div>
                  ))}
                </div>
                <div className="os-barra"><i style={{ width: `${progresso}%` }} /><em>{progresso}%</em></div>
              </div>
            )}
            <h2 className="os-num">#Ordem de Serviço: {o.number}</h2>
            {o.service_requests?.protocol && <div className="muted" style={{ marginBottom: 6 }}>Chamado {o.service_requests.protocol}</div>}
            {(o.tags ?? []).length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {(o.tags as string[]).map((tg) => (
                  <form key={tg} action={removerTag} className="os-tag">
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="tag" value={tg} />
                    {tg}{editar && <button title="Remover tag">×</button>}
                  </form>
                ))}
              </div>
            )}
            <form action={salvar} className="os-form">
              <input type="hidden" name="id" value={o.id} />
              <label className="field">Origem Cliente
                <select name="origem" defaultValue={o.origem ?? ""} disabled={!editar}>
                  <option value="">—</option>
                  {["Cliente", "Balcão", "Telefone", "WhatsApp", "Indicação", "Site"].map((x) => <option key={x}>{x}</option>)}
                </select>
              </label>
              <label className="field">Garantia
                <select name="warranty" defaultValue={o.warranty ? "sim" : "nao"} disabled={!editar}>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </label>
              <label className="field">Termo
                <input name="termo" list="termos" defaultValue={o.termo ?? ""} disabled={!editar} />
                <datalist id="termos">{(termosGar ?? []).map((x: any) => <option key={x.name} value={x.name} />)}</datalist>
              </label>
              <label className="field">Situação
                <input name="situacao" list="situacoes" defaultValue={o.situacao ?? ""} disabled={!editar} />
                <datalist id="situacoes">{SITUACOES_OS.map((x) => <option key={x} value={x} />)}</datalist>
              </label>
              <label className="field">Status
                <select name="status" defaultValue={o.status} disabled={!editar}>
                  {Object.entries(STATUS_OS).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                </select>
              </label>

              <div className="field" style={{ gridColumn: "span 3" }}>
                Cliente
                <div className="os-ro">
                  <b>{o.clients?.name}</b>{o.clients?.phone && <> | Tel: {o.clients.phone}</>}
                  <Link href={`/clientes/${o.clients?.id}`} style={{ marginLeft: "auto", color: "var(--link)" }}>abrir cadastro</Link>
                  <Zap telefone={o.clients?.mobile || o.clients?.phone} mensagem={msgStatus} />
                </div>
              </div>
              <label className="field">Solicitante
                <input name="contact_name" defaultValue={o.contact_name ?? ""} disabled={!editar} />
              </label>
              <label className="field">Tipo O.S
                <select name="tipo_os" defaultValue={o.tipo_os ?? ""} disabled={!editar}>
                  <option value="">—</option>
                  {["Avulsa", "Contrato", "Balcão", "Garantia"].map((x) => <option key={x}>{x}</option>)}
                </select>
              </label>

              <label className="field">Entrada
                <input value={fmtData(o.entry_at)} readOnly />
              </label>
              <label className="field">Prazo
                <input name="deadline" type="date" defaultValue={o.deadline ?? ""} disabled={!editar} />
              </label>
              <label className="field">Prioridade
                <select name="priority" defaultValue={o.priority} disabled={!editar}>
                  {Object.entries(PRIORIDADE_OS).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                </select>
              </label>
              <label className="field">Filial
                <select name="filial" defaultValue={o.filial ?? ""} disabled={!editar}>
                  <option value="">----</option>
                  {(filiais ?? []).map((b: any) => <option key={b.name}>{b.name}</option>)}
                </select>
              </label>
              <label className="field">Atendente
                <select name="atendente_id" defaultValue={o.created_by ?? ""} disabled={!editar}>
                  <option value="">—</option>
                  {(equipe ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.full_name || "Sem nome"}</option>)}
                </select>
              </label>
              <label className="field">Técnico
                <select name="technician_id" defaultValue={o.technician_id ?? ""} disabled={!editar}>
                  <option value="">Ninguém</option>
                  {(equipe ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.full_name || "Sem nome"}</option>)}
                </select>
              </label>
              <label className="field">Nº da nota fiscal
                <input name="external_invoice_number" defaultValue={o.external_invoice_number ?? ""} disabled={!editar} />
              </label>

              <label className="field" style={{ gridColumn: "span 3" }}>Relato do Cliente
                <textarea name="defect" rows={4} defaultValue={o.defect ?? ""} disabled={!editar} />
              </label>
              <label className="field" style={{ gridColumn: "span 2" }}>Observações
                <textarea name="observacoes" rows={4} defaultValue={o.observacoes ?? ""} disabled={!editar} />
              </label>
              <label className="field" style={{ gridColumn: "1/-1" }}>Laudo Técnico
                <textarea name="report" rows={4} defaultValue={o.report ?? ""} disabled={!editar} />
              </label>
              <label className="field" style={{ gridColumn: "1/-1" }}>Orçamento Rápido (texto que sai na impressão)
                <textarea name="quote_text" rows={4} defaultValue={o.quote_text ?? ""} disabled={!editar} placeholder="Ex.: serviços necessários e valores combinados com o cliente" />
              </label>
              {editar && (
                <div style={{ gridColumn: "1/-1" }}>
                  <button className="btn primary">Salvar</button>
                </div>
              )}
            </form>

            <div id="aprovacao" style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
              <h3 style={{ marginTop: 0 }}>Aprovação do orçamento</h3>
              {!o.approval_status ? (
                editar ? (
                  <form action={enviarAprovacao}>
                    <input type="hidden" name="order_id" value={o.id} />
                    <p className="muted" style={{ marginTop: 0 }}>Gera um link para o cliente ver o orçamento, aprovar e assinar pelo celular.</p>
                    <button className="btn secondary">Gerar link de aprovação</button>
                  </form>
                ) : (
                  <p className="muted">Ainda não enviado ao cliente.</p>
                )
              ) : (
                <>
                  <p>
                    Situação: <b>{o.approval_status === "pendente" ? "Aguardando o cliente" : o.approval_status === "aprovado" ? "Aprovado" : "Recusado"}</b>
                    {o.approval_name && <> · {o.approval_name}</>}
                    {o.approval_note && <> · “{o.approval_note}”</>}
                  </p>
                  <p style={{ wordBreak: "break-all" }}>
                    Link: <Link href={`/orcamento/${o.approval_token}`} style={{ color: "var(--link)" }}>{`/orcamento/${o.approval_token}`}</Link>
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <a
                      className="btn secondary"
                      href={`https://wa.me/${String(o.clients?.phone ?? "").replace(/\D/g, "").replace(/^(\d{10,11})$/, "55$1")}?text=${encodeURIComponent(
                        `Olá! Segue o orçamento da OS #${o.number} para sua aprovação: ${process.env.NEXT_PUBLIC_SITE_URL ?? "https://inforgest.com.br"}/orcamento/${o.approval_token}`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Enviar por WhatsApp
                    </a>
                    {editar && o.approval_status !== "pendente" && (
                      <form action={enviarAprovacao}>
                        <input type="hidden" name="order_id" value={o.id} />
                        <input type="hidden" name="refazer" value="1" />
                        <button className="btn secondary">Pedir nova aprovação</button>
                      </form>
                    )}
                  </div>
                  {o.approval_signature && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.approval_signature} alt="Assinatura do cliente" style={{ background: "#fff", borderRadius: 8, maxWidth: 260, marginTop: 10 }} />
                  )}
                </>
              )}
            </div>
          </>
        )}

        {aba === "equipamentos" && (
          <>
            <div className="os-bloco">
              {editar && (
                <form action={vincularEquipamento} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input type="hidden" name="order_id" value={o.id} />
                  <select name="equipment_id" defaultValue="" style={{ flex: 1, minWidth: 220 }}>
                    <option value="">Escolha um equipamento do cliente…</option>
                    {eqLivres.map((e: any) => <option key={e.id} value={e.id}>{e.code} · {e.brand} {e.model} {e.serial_number ? `· série ${e.serial_number}` : ""}</option>)}
                  </select>
                  <button className="btn primary">Vincular</button>
                  <Link className="btn secondary" href={`/equipamentos/novo?client=${o.client_id}`}>+ Novo equipamento</Link>
                </form>
              )}
              <p className="muted" style={{ margin: "8px 0 0" }}>Cliente possui {(eqCliente ?? []).length} equipamento(s) cadastrado(s).</p>
            </div>
            <table className="table" style={{ marginTop: 12 }}>
              <thead><tr><th>Código</th><th>Equipamento</th><th>Série</th><th></th></tr></thead>
              <tbody>
                {eqVinculados.map((e: any) => (
                  <tr key={e.id}>
                    <td><Link href={`/equipamentos/${e.id}`} style={{ color: "var(--link)" }}>{e.code}</Link></td>
                    <td>{e.brand} {e.model}</td>
                    <td>{e.serial_number ?? "—"}</td>
                    <td>
                      {editar && (
                        <form action={desvincularEquipamento}>
                          <input type="hidden" name="order_id" value={o.id} />
                          <input type="hidden" name="equipment_id" value={e.id} />
                          <button className="btn secondary">Remover</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {!eqVinculados.length && <tr><td colSpan={4} className="muted">Nenhum equipamento vinculado.</td></tr>}
              </tbody>
            </table>
            <div className="os-bloco" style={{ marginTop: 14 }}>
              <h3 style={{ margin: "0 0 4px" }}>Acessórios</h3>
              <div className="muted" style={{ marginBottom: 8 }}>O que acompanha o equipamento (carregador, capa, cabo…)</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {(o.acessorios ?? []).map((a: string) => (
                  <form key={a} action={salvarAcessorios} className="os-tag">
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="remover" value={a} />
                    {a}{editar && <button title="Remover">×</button>}
                  </form>
                ))}
                {!(o.acessorios ?? []).length && <span className="muted">Nenhum acessório informado.</span>}
              </div>
              {editar && (
                <form action={salvarAcessorios} style={{ display: "flex", gap: 8 }}>
                  <input type="hidden" name="id" value={o.id} />
                  <input name="acessorio" placeholder="Digite um acessório" style={{ flex: 1 }} />
                  <button className="btn secondary">Adicionar</button>
                </form>
              )}
            </div>
          </>
        )}

        {aba === "checklists" && (
          <>
            {!(checks ?? []).length ? (
              <div className="os-vazio">
                <b>Nenhum checklist nesta OS</b>
                <span className="muted">Adicione um checklist para registrar o estado do equipamento e dos testes finais.</span>
                {editar && (
                  <form action={adicionarChecklist}>
                    <input type="hidden" name="order_id" value={o.id} />
                    <button className="btn primary">+ Adicionar Checklist</button>
                  </form>
                )}
              </div>
            ) : (
              (checks ?? []).map((c: any) => (
                <form key={c.id} action={salvarChecklist} className="os-bloco" style={{ marginBottom: 12 }}>
                  <input type="hidden" name="order_id" value={o.id} />
                  <input type="hidden" name="id" value={c.id} />
                  <h3 style={{ marginTop: 0 }}>{c.title}</h3>
                  <table className="table">
                    <thead><tr><th>Item</th><th style={{ width: 200 }}>Resultado</th></tr></thead>
                    <tbody>
                      {(c.items ?? []).map((it: any, i: number) => (
                        <tr key={i}>
                          <td>{it.name}</td>
                          <td>
                            <select name={`item_${i}`} defaultValue={it.v ?? ""} disabled={!editar}>
                              <option value="">—</option>
                              <option value="ok">OK</option>
                              <option value="nok">Com defeito</option>
                              <option value="na">Não se aplica</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {editar && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button className="btn primary">Salvar checklist</button>
                      <button className="btn secondary" name="reiniciar" value="1">Reiniciar Checklist</button>
                      <button className="btn secondary" formAction={removerChecklist}>Remover</button>
                    </div>
                  )}
                </form>
              ))
            )}
          </>
        )}

        {aba === "itens" && (
          <>
            {(["peca", "servico"] as const).map((k) => (
              <div key={k} className="os-bloco" style={{ marginBottom: 14 }}>
                <h3 style={{ marginTop: 0 }}>{k === "peca" ? "Produtos" : "Serviços"}</h3>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Descrição</th><th>Qtd</th>
                      {verFin && <th>Valor unit.</th>}
                      {verFin && <th>Subtotal</th>}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(itens ?? []).filter((i: any) => i.kind === k).map((i: any) => (
                      <tr key={i.id}>
                        <td>{i.description}</td>
                        <td>{Number(i.quantity)}</td>
                        {verFin && (
                          <td>
                            {editFin ? (
                              <input form="fin" name={`preco_${i.id}`} inputMode="decimal" defaultValue={precoItem[i.id] ?? 0} style={{ width: 90 }} aria-label="Valor unitário" />
                            ) : moeda(precoItem[i.id])}
                          </td>
                        )}
                        {verFin && <td>{moeda(Number(i.quantity) * (precoItem[i.id] ?? 0))}</td>}
                        <td>
                          {editar && (
                            <form action={removerItem}>
                              <input type="hidden" name="id" value={i.id} />
                              <input type="hidden" name="order_id" value={o.id} />
                              <button className="btn secondary">Remover</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!(itens ?? []).some((i: any) => i.kind === k) && (
                      <tr><td colSpan={5} className="muted">Nenhum {k === "peca" ? "produto" : "serviço"} adicionado.</td></tr>
                    )}
                  </tbody>
                </table>
                {editar && (
                  <form action={adicionarItem} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "end" }}>
                    <input type="hidden" name="order_id" value={o.id} />
                    <input type="hidden" name="kind" value={k} />
                    {k === "servico" ? (
                      <label className="field" style={{ minWidth: 200 }}>Serviço do catálogo
                        <select name="service_id" defaultValue="">
                          <option value="">—</option>
                          {(servicos ?? []).map((sv: any) => <option key={sv.id} value={sv.id}>{sv.name}</option>)}
                        </select>
                      </label>
                    ) : (
                      <label className="field" style={{ minWidth: 200 }}>Produto do estoque
                        <select name="part_id" defaultValue="">
                          <option value="">—</option>
                          {(pecas ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ""}</option>)}
                        </select>
                      </label>
                    )}
                    <label className="field" style={{ flex: 1, minWidth: 160 }}>Descrição (opcional)
                      <input name="description" />
                    </label>
                    <label className="field" style={{ width: 80 }}>Qtd
                      <input name="quantity" defaultValue="1" inputMode="decimal" />
                    </label>
                    <button className="btn secondary">+ Adicionar</button>
                  </form>
                )}
              </div>
            ))}
            {verFin && (
              <form id="fin" action={salvarFinanceiro} className="os-bloco grid g4">
                <input type="hidden" name="order_id" value={o.id} />
                <h3 style={{ gridColumn: "1/-1", margin: 0 }}>Valores</h3>
                <div><div className="muted">Subtotal</div><b>{moeda(subtotal)}</b></div>
                <label className="field">Desconto (R$)
                  <input name="discount" inputMode="decimal" defaultValue={Number(fin.discount ?? 0)} disabled={!editFin} />
                </label>
                <label className="field">Adiantamento (R$)
                  <input name="advance" inputMode="decimal" defaultValue={Number(fin.advance ?? 0)} disabled={!editFin} />
                </label>
                <div><div className="muted">Total / a pagar</div><b>{moeda(total)}</b> / <b>{moeda(aPagar)}</b></div>
                <label className="field">Forma de pagamento
                  <input name="payment_method" list="formas" defaultValue={fin.payment_method ?? ""} disabled={!editFin} />
                  <datalist id="formas">{["Pix", "Dinheiro", "Débito", "Crédito", "Boleto", "Transferência"].map((f) => <option key={f} value={f} />)}</datalist>
                </label>
                <label className="field">Vencimento
                  <input name="due_date" type="date" defaultValue={fin.due_date ?? ""} disabled={!editFin} />
                </label>
                {editFin && <div style={{ gridColumn: "1/-1" }}><button className="btn primary">Salvar valores</button></div>}
              </form>
            )}
            {editFin && o.status === "concluido" && (
              <form action={faturar} className="os-bloco" style={{ marginTop: 14 }}>
                <input type="hidden" name="order_id" value={o.id} />
                <b>Faturar esta OS</b>
                <p className="muted" style={{ margin: "6px 0 10px" }}>Gera a receita no financeiro (e o adiantamento como já recebido) e muda o status para Faturado. Salve os valores antes.</p>
                <button className="btn primary">Faturar OS</button>
              </form>
            )}
            {verFin && (
              <div className="os-bloco" style={{ marginTop: 14 }}>
                <b>Custo interno</b>
                <p className="muted" style={{ margin: "6px 0 10px" }}>Despesas desta OS (peça comprada fora, frete, terceirizado…). Entram no Financeiro como despesa.</p>
                {editFin && (
                  <form action={custoInterno} className="grid g4">
                    <input type="hidden" name="order_id" value={o.id} />
                    <label className="field">Fornecedor / empresa<input name="party" /></label>
                    <label className="field">Descrição<input name="description" placeholder={`Custo OS - #${o.number}`} /></label>
                    <label className="field">Categoria<input name="category" defaultValue="Custos" /></label>
                    <label className="field">Valor (R$)<input name="amount" inputMode="decimal" required /></label>
                    <label className="field">Vencimento<input type="date" name="due_date" /></label>
                    <label className="field">Anotações<input name="notes" /></label>
                    <label className="field" style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><input type="checkbox" name="pago" /> Pago</label>
                    <div style={{ alignSelf: "end" }}><button className="btn secondary">Lançar custo</button></div>
                  </form>
                )}
                {!!custos.length && (
                  <table className="table" style={{ marginTop: 10 }}>
                    <thead><tr><th>Descrição</th><th>Fornecedor</th><th>Vencimento</th><th>Situação</th><th>Valor</th>{editFin && <th></th>}</tr></thead>
                    <tbody>
                      {custos.map((c) => (
                        <tr key={c.id}>
                          <td>{c.description}</td><td>{c.party ?? "—"}</td><td>{fmtData(c.due_date)}</td><td>{c.paid_at ? "Pago" : "Em aberto"}</td><td>{moeda(c.amount)}</td>
                          {editFin && <td><form action={removerCusto}><input type="hidden" name="order_id" value={o.id} /><input type="hidden" name="id" value={c.id} /><button className="btn secondary">Remover</button></form></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
            {verFin && o.status === "faturado" && (
              <p className="muted" style={{ marginTop: 14 }}>OS faturada — veja a receita em <Link href="/financeiro" style={{ color: "var(--link)" }}>Financeiro</Link>.</p>
            )}
          </>
        )}

        {aba === "tarefas" && (
          <>
            <div className="os-sub">
              <Link href={`/os/${o.id}?aba=tarefas`} className={minhas ? "ativa" : ""}>Minhas</Link>
              <Link href={`/os/${o.id}?aba=tarefas&t=todas`} className={!minhas ? "ativa" : ""}>Todas</Link>
            </div>
            {editar && (
              <form action={novaTarefa} style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
                <input type="hidden" name="order_id" value={o.id} />
                <input name="title" placeholder="Nova tarefa…" required style={{ flex: 1, minWidth: 220 }} />
                <select name="assignee_id" defaultValue={meuId ?? ""}>
                  <option value="">Sem responsável</option>
                  {(equipe ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.full_name || "Sem nome"}</option>)}
                </select>
                <button className="btn primary">+ Nova tarefa</button>
              </form>
            )}
            <table className="table">
              <thead><tr><th style={{ width: 40 }}></th><th>Tarefa</th><th>Responsável</th><th>Criado por</th><th></th></tr></thead>
              <tbody>
                {pendentes.map((x: any) => (
                  <tr key={x.id}>
                    <td>
                      <form action={alternarTarefa}>
                        <input type="hidden" name="order_id" value={o.id} /><input type="hidden" name="id" value={x.id} /><input type="hidden" name="done" value="1" />
                        <button className="btn secondary" title="Concluir">✓</button>
                      </form>
                    </td>
                    <td>{x.title}</td><td>{nomeDe(x.assignee_id)}</td><td>{nomeDe(x.created_by)}</td>
                    <td>{editar && <form action={excluirTarefa}><input type="hidden" name="order_id" value={o.id} /><input type="hidden" name="id" value={x.id} /><button className="btn secondary">Excluir</button></form>}</td>
                  </tr>
                ))}
                {!pendentes.length && <tr><td colSpan={5} className="muted" style={{ textAlign: "center" }}>Nenhuma tarefa pendente.</td></tr>}
              </tbody>
            </table>
            <details style={{ marginTop: 10 }}>
              <summary>Concluídas ({concluidas.length})</summary>
              <table className="table" style={{ marginTop: 8 }}>
                <tbody>
                  {concluidas.map((x: any) => (
                    <tr key={x.id}>
                      <td style={{ width: 40 }}>
                        <form action={alternarTarefa}>
                          <input type="hidden" name="order_id" value={o.id} /><input type="hidden" name="id" value={x.id} /><input type="hidden" name="done" value="0" />
                          <button className="btn secondary" title="Reabrir">↺</button>
                        </form>
                      </td>
                      <td style={{ textDecoration: "line-through" }}>{x.title}</td><td>{nomeDe(x.assignee_id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}

        {aba === "anexos" && (
          <>
            {grupos.map(([g, nome]) => (
              <div key={g} className="os-bloco" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <b style={{ textTransform: "uppercase", fontSize: 12 }}>{nome}</b>
                  {editar && (
                    <form action={enviarAnexo} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input type="hidden" name="order_id" value={o.id} />
                      <input type="hidden" name="grupo" value={g} />
                      <input type="file" name="arquivo" accept="image/*,application/pdf" capture="environment" multiple style={{ maxWidth: 220 }} />
                      <button className="btn primary">Anexar</button>
                    </form>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                  {fotos.filter((f) => (f.grupo ?? "antes") === g).map((f) => (
                    <div key={f.id} style={{ textAlign: "center" }}>
                      <a href={f.url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.url} alt={f.nome || "anexo"} style={{ width: 130, height: 130, objectFit: "cover", borderRadius: 8 }} />
                      </a>
                      {editar && (
                        <form action={removerAnexo}>
                          <input type="hidden" name="order_id" value={o.id} /><input type="hidden" name="id" value={f.id} />
                          <button className="btn secondary" style={{ marginTop: 4 }}>Remover</button>
                        </form>
                      )}
                    </div>
                  ))}
                  {!fotos.some((f) => (f.grupo ?? "antes") === g) && <span className="muted">Nenhum anexo neste grupo.</span>}
                </div>
              </div>
            ))}
          </>
        )}

        {aba === "assinatura" && (
          <div className="os-bloco">
            {o.signature_data ? (
              <>
                <b>OS assinada</b>
                <div className="muted">em {o.signature_at ? fmtDH(o.signature_at) : "—"}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.signature_data} alt="Assinatura" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 8, maxWidth: 360, marginTop: 10, display: "block" }} />
                {editar && (
                  <form action={limparAssinatura} style={{ marginTop: 10 }}>
                    <input type="hidden" name="order_id" value={o.id} />
                    <button className="btn secondary">Refazer assinatura</button>
                  </form>
                )}
              </>
            ) : editar ? (
              <>
                <b>Esta OS ainda não foi assinada</b>
                <p className="muted">Peça ao cliente para assinar na tela do dispositivo, com o dedo ou o mouse. A assinatura fica guardada na OS e vai na impressão.</p>
                <AssinaturaOS action={salvarAssinatura} orderId={o.id} />
              </>
            ) : (
              <p className="muted">Esta OS ainda não foi assinada.</p>
            )}
          </div>
        )}

        {aba === "logs" && editar && (
          <form action={adicionarAtividade} className="inline" style={{ marginBottom: 12 }}>
            <input type="hidden" name="order_id" value={o.id} />
            <input name="texto" placeholder="Descreva a atividade realizada" style={{ flex: 1, minWidth: 260 }} />
            <button className="btn primary">+ Adicionar atividade</button>
          </form>
        )}
        {aba === "logs" && (
          <table className="table">
            <thead><tr><th>Usuário</th><th>Tarefa</th><th style={{ width: 150 }}>Data / hora</th></tr></thead>
            <tbody>
              {(logs ?? []).map((l: any) => (
                <tr key={l.id}>
                  <td>{l.user_name ?? "—"}</td>
                  <td dangerouslySetInnerHTML={{ __html: String(l.text).replace(/<(?!\/?b>)[^>]*>/g, "") }} />
                  <td>{fmtDH(l.created_at)}</td>
                </tr>
              ))}
              {!(logs ?? []).length && <tr><td colSpan={3} className="muted" style={{ textAlign: "center" }}>Sem registros ainda.</td></tr>}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
