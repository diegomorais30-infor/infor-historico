import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Importador temporário Inforos → InforGest. Protegido por IMPORT_TOKEN.
// Recebe os registros crus do Inforos e grava tudo (inclusive o JSON original em legacy_data).
const EMPRESA = "b62f347c-79c7-432c-9b15-b8fc60524152";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-import-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const s = (x: any) => (x === null || x === undefined || String(x).trim() === "" ? null : String(x).trim());
const dt = (x: any) => { const v = s(x); return v && !v.startsWith("0000") ? v : null; };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const token = process.env.IMPORT_TOKEN;
  if (!token || req.headers.get("x-import-token") !== token) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401, headers: CORS });
  }
  const { tipo, registros } = await req.json();
  const db = createAdminClient();
  let ok = 0, ignorados = 0;
  const erros: string[] = [];

  if (tipo === "clientes") {
    const { data: forn } = await db.from("suppliers").select("legacy_ref").eq("company_id", EMPRESA);
    const ehForn = new Set((forn ?? []).map((f: any) => f.legacy_ref));
    const linhas = [];
    for (const r of registros) {
      const id = String(r.idClientes);
      if (ehForn.has(id)) { ignorados++; continue; }
      if (String(r.tipo) === "fornecedor") {
        await db.from("suppliers").upsert({ company_id: EMPRESA, legacy_ref: id, name: s(r.nomeCliente) ?? "(sem nome)", document: s(r.documento), phone: s(r.telefone) ?? s(r.celular), email: s(r.email), contact_name: s(r.responsavel), address: [s(r.rua), s(r.numero), s(r.bairro)].filter(Boolean).join(", ") || null, city: s(r.cidade), state: s(r.estado), notes: s(r.observacoes), active: String(r.ativo) !== "0" }, { onConflict: "company_id,legacy_ref" });
        ignorados++; continue;
      }
      linhas.push({
        company_id: EMPRESA,
        legacy_ref: id,
        name: s(r.nomeCliente) ?? "(sem nome)",
        trade_name: s(r.nome_fantasia),
        document: s(r.documento),
        phone: s(r.telefone),
        mobile: s(r.celular),
        email: s(r.email),
        contact_name: s(r.responsavel),
        address: [s(r.rua), s(r.numero), s(r.complemento), s(r.bairro)].filter(Boolean).join(", ") || null,
        street_number: s(r.numero),
        complement: s(r.complemento),
        neighborhood: s(r.bairro),
        cep: s(r.cep),
        city: s(r.cidade),
        state: s(r.estado),
        notes: s(r.observacoes),
        person_type: String(r.pessoa_fisica) === "1" ? "pf" : "pj",
        gender: s(r.sexo),
        birthday: dt(r.aniversario),
        origin: s(r.origemCliente),
        state_registration: s(r.inscricaoEstadual),
        municipal_registration: s(r.inscricaoMunicipal),
        municipal_code: s(r.codigoMunicipio),
        iss_retido: r.issRetido === null || r.issRetido === undefined ? null : String(r.issRetido) === "1",
        is_contract: String(r.tipo ?? "") === "contrato",
        registered_at: dt(r.dataCadastro ? r.dataCadastro + "T00:00:00-03:00" : null),
        active: String(r.ativo) !== "0",
        legacy_data: r,
      });
    }
    const { error } = await db.from("clients").upsert(linhas, { onConflict: "company_id,legacy_ref" });
    if (error) erros.push(error.message); else ok = linhas.length;
  } else if (tipo === "equipamentos") {
    // atualiza campos completos dos equipamentos já importados
    for (const r of registros) {
      const { error } = await db.from("equipment").update({
        color: s(r.cor),
        voltage: s(r.voltagem) ?? s(r.tensao),
        power: s(r.potencia),
        manufactured_at: dt(r.data_fabricacao),
        legacy_data: r,
      }).eq("company_id", EMPRESA).eq("legacy_ref", String(r.idEquipamentos));
      if (error) erros.push(error.message); else ok++;
    }
  } else if (tipo === "os") {
    const norm = (x: any) => String(x ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const STATUS: Record<string, string> = { entrada: "entrada", orcamento: "orcamento", aberto: "aberto", andamento: "andamento", "em andamento": "andamento", pausado: "pausado", concluido: "concluido", faturado: "faturado", finalizado: "finalizado", cancelado: "cancelado" };
    const PRIO: Record<string, string> = { "1": "baixa", "2": "baixa", "3": "normal", "4": "alta", "5": "urgente" };
    const num = (x: any) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
    const { data: cls } = await db.from("clients").select("id, legacy_ref").eq("company_id", EMPRESA).not("legacy_ref", "is", null);
    const { data: eqs } = await db.from("equipment").select("id, legacy_ref").eq("company_id", EMPRESA).not("legacy_ref", "is", null);
    const mc = new Map((cls ?? []).map((c: any) => [String(c.legacy_ref), c.id]));
    const me = new Map((eqs ?? []).map((c: any) => [String(c.legacy_ref), c.id]));
    for (const r of registros) {
      const l = r.l ?? {}; const d = r.d ?? {};
      const ref = String(l.idOs);
      const clienteId = mc.get(String(l.clientes_id));
      if (!clienteId) { erros.push(`OS ${ref}: cliente ${l.clientes_id} não encontrado`); continue; }
      const eqLista = Array.isArray(l.equipamentos) ? l.equipamentos : [];
      let equipId: string | null = null;
      for (const e of eqLista) { const x = me.get(String(e.equipamentos_id)); if (x) { equipId = x; break; } }
      const status = STATUS[norm(l.status)] ?? "aberto";
      const fechada = ["concluido", "faturado", "finalizado"].includes(status);
      const linha = {
        company_id: EMPRESA,
        legacy_ref: ref,
        number: Number(l.idOs),
        client_id: clienteId,
        equipment_id: equipId,
        status,
        priority: PRIO[String(l.prioridade)] ?? "normal",
        situacao: s(l.autorizacao),
        defect: s(l.descricaoProduto) ?? s(l.defeito),
        report: s(l.laudoTecnico),
        deadline: dt(l.prazo) ? String(l.prazo).slice(0, 10) : null,
        entry_at: dt(l.dataInicial) ? String(l.dataInicial).replace(" ", "T") + "-03:00" : null,
        closed_at: fechada ? (dt(l.dataFinal) ?? dt(l.conclusao) ?? dt(l.dataFaturado)) && String(dt(l.dataFinal) ?? dt(l.conclusao) ?? dt(l.dataFaturado)).replace(" ", "T") + "-03:00" : null,
        stock_deducted: fechada,
        legacy_data: { lista: l, detalhe: d },
      };
      const { data: os, error } = await db.from("service_orders").upsert(linha, { onConflict: "company_id,legacy_ref" }).select("id").single();
      if (error || !os) { erros.push(`OS ${ref}: ${error?.message}`); continue; }
      // itens (recria)
      await db.from("service_order_items").delete().eq("order_id", os.id);
      const itens: any[] = [];
      for (const [kind, arr] of [["peca", d.itens?.produtos], ["servico", d.itens?.servicos]] as const) {
        for (const it of (arr ?? [])) {
          const q = num(it.quantidade);
          itens.push({ company_id: EMPRESA, order_id: os.id, kind, description: [s(it.nome), s(it.descritivo)].filter(Boolean).join(" — ") || "(sem descrição)", quantity: q > 0 ? q : 1 });
        }
      }
      if (itens.length) { const { error: e2 } = await db.from("service_order_items").insert(itens); if (e2) erros.push(`OS ${ref} itens: ${e2.message}`); }
      const desc = num(d.totais?.desconto ?? l.desconto), adi = num(d.totais?.adiantamento);
      if (desc || adi) await db.from("order_finance").upsert({ order_id: os.id, company_id: EMPRESA, discount: desc, advance: adi, payment_method: s(d.formasPagamento) }, { onConflict: "order_id" });
      ok++;
    }
  } else {
    return NextResponse.json({ erro: "tipo desconhecido" }, { status: 400, headers: CORS });
  }
  return NextResponse.json({ ok, ignorados, erros: erros.slice(0, 5) }, { headers: CORS });
}
