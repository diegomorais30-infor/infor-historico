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
    const { data: cls0 } = await db.from("clients").select("id, legacy_ref").eq("company_id", EMPRESA).not("legacy_ref", "is", null);
    const mc0 = new Map((cls0 ?? []).map((c: any) => [String(c.legacy_ref), c.id]));
    for (const r of registros) {
      const { data: jaTem } = await db.from("equipment").select("id").eq("company_id", EMPRESA).eq("legacy_ref", String(r.idEquipamentos)).maybeSingle();
      if (!jaTem) {
        const cid = mc0.get(String(r.clientes_id ?? r.idClientes));
        if (!cid) { erros.push(`equip ${r.idEquipamentos}: cliente ${r.clientes_id} não encontrado`); continue; }
        const { error: ei } = await db.from("equipment").insert({
          company_id: EMPRESA, legacy_ref: String(r.idEquipamentos), client_id: cid, equipment_type: s(r.equipamento), brand: s(r.marca), model: s(r.modelo),
          serial_number: s(r.serial_number), asset_tag: s(r.num_serie), status: "active", notes: s(r.cor) ? `Cor: ${s(r.cor)}` : s(r.observacoes),
          color: s(r.cor), voltage: s(r.voltagem) ?? s(r.tensao), power: s(r.potencia), manufactured_at: dt(r.data_fabricacao), legacy_data: r,
        });
        if (ei) erros.push(`equip ${r.idEquipamentos}: ${ei.message}`); else ok++;
        continue;
      }
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
    const PRIO: Record<string, string> = { "1": "alta", "2": "normal", "3": "baixa" };
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
      if (itens.length) {
        const { data: criados, error: e2 } = await db.from("service_order_items").insert(itens).select("id");
        if (e2) erros.push(`OS ${ref} itens: ${e2.message}`);
        else {
          // preço de cada item = subtotal / quantidade vindos do Inforos (o gatilho do banco só preenche pelo catálogo)
          const origem = [...(d.itens?.produtos ?? []), ...(d.itens?.servicos ?? [])];
          for (let k = 0; k < (criados ?? []).length; k++) {
            const q = num(origem[k]?.quantidade) || 1;
            const preco = num(origem[k]?.subTotal) / q;
            await db.from("item_prices").update({ unit_price: preco }).eq("item_id", (criados as any[])[k].id);
          }
        }
      }
      const desc = num(d.totais?.desconto ?? l.desconto), adi = num(d.totais?.adiantamento);
      if (desc || adi) await db.from("order_finance").upsert({ order_id: os.id, company_id: EMPRESA, discount: desc, advance: adi, payment_method: s(d.formasPagamento) }, { onConflict: "order_id" });
      ok++;
    }
  } else if (tipo === "produtos") {
    const num = (x: any) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
    for (const r of registros) {
      const { data: p, error } = await db.from("parts").upsert({
        company_id: EMPRESA, legacy_ref: String(r.idProdutos), name: s(r.descricao) ?? "(sem nome)", description: s(r.observacoes),
        barcode: s(r.barcode), unit: s(r.unidade), stock_quantity: Math.max(num(r.estoqueReal), 0), minimum_stock: Math.max(num(r.estoqueMinimo), 0),
        active: String(r.ativo) !== "0", legacy_data: r,
      }, { onConflict: "company_id,legacy_ref" }).select("id").single();
      if (error || !p) { erros.push(`produto ${r.idProdutos}: ${error?.message}`); continue; }
      await db.from("part_prices").upsert({ part_id: p.id, company_id: EMPRESA, sale_price: num(r.precoVenda), cost_price: num(r.precoCompra) }, { onConflict: "part_id" });
      ok++;
    }
  } else if (tipo === "servicos") {
    for (const r of registros) {
      const { data: sv, error } = await db.from("catalog_services").upsert({
        company_id: EMPRESA, legacy_ref: String(r.idServicos), name: s(r.nome) ?? "(sem nome)", description: s(r.descricao), active: String(r.ativo) !== "0", legacy_data: r,
      }, { onConflict: "company_id,legacy_ref" }).select("id").single();
      if (error || !sv) { erros.push(`servico ${r.idServicos}: ${error?.message}`); continue; }
      await db.from("service_prices").upsert({ service_id: sv.id, company_id: EMPRESA, price: Number(r.preco) || 0 }, { onConflict: "service_id" });
      ok++;
    }
  } else if (tipo === "vendas") {
    const num = (x: any) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
    const { data: cls } = await db.from("clients").select("id, legacy_ref").eq("company_id", EMPRESA).not("legacy_ref", "is", null);
    const mc = new Map((cls ?? []).map((c: any) => [String(c.legacy_ref), c.id]));
    for (const r of registros) {
      const l = r.l ?? {}; const d = r.d ?? {};
      const ref = String(l.idVendas);
      const { data: v, error } = await db.from("sales").upsert({
        company_id: EMPRESA, legacy_ref: ref, number: Number(l.idVendas), client_id: mc.get(String(l.clientes_id)) ?? null,
        sold_at: dt(l.dataVenda) ? String(l.dataVenda).slice(0, 10) : String(l.created_at ?? "").slice(0, 10),
        total: num(l.valorTotal), discount: num(l.desconto), freight: num(l.valor_frete), billed: String(l.faturado) === "1",
        seller: s(d.vendedor), origin: s(l.origemVenda), notes: s(d.observacoes) ?? s(l.obsVendas), legacy_data: { lista: l, detalhe: d },
      }, { onConflict: "company_id,legacy_ref" }).select("id").single();
      if (error || !v) { erros.push(`venda ${ref}: ${error?.message}`); continue; }
      await db.from("sale_items").delete().eq("sale_id", v.id);
      const itens = (d.itens ?? []).map((it: any) => ({ company_id: EMPRESA, sale_id: v.id, kind: "produto", description: [s(it.nome), s(it.descritivo)].filter(Boolean).join(" — ") || "(sem descrição)", quantity: num(it.quantidade) || 1, unit_price: num(it.valor), discount: num(it.desconto), legacy_data: it }));
      if (itens.length) { const { error: e2 } = await db.from("sale_items").insert(itens); if (e2) erros.push(`venda ${ref} itens: ${e2.message}`); }
      ok++;
    }
  } else if (tipo === "financeiro") {
    const num = (x: any) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
    const { cat = {}, linhas: regs } = registros as any;
    const get = async (tab: string) => { const { data } = await db.from(tab).select("id, legacy_ref").eq("company_id", EMPRESA).not("legacy_ref", "is", null); return new Map((data ?? []).map((c: any) => [String(c.legacy_ref), c.id])); };
    const [mc, ms, mo, mv] = await Promise.all([get("clients"), get("suppliers"), get("service_orders"), get("sales")]);
    const linhas = (regs as any[]).map((r) => {
      const valor = Math.max(num(r.valor) - num(r.desconto) + num(r.juros), 0);
      const origem = String(r.origem ?? "");
      return {
        company_id: EMPRESA, legacy_ref: String(r.idFaturas), kind: String(r.tipo) === "receita" ? "receita" : "despesa",
        description: s(r.descricao) ?? "(sem descrição)", category: cat[String(r.categorias_id)] ?? null, party: s(r.cliente_fornecedor),
        client_id: mc.get(String(r.clientes_id)) ?? null, supplier_id: String(r.tipo) === "despesa" ? ms.get(String(r.clientes_id)) ?? null : null,
        order_id: origem === "Os" ? mo.get(String(r.origem_id)) ?? null : null, sale_id: origem === "Vendas" ? mv.get(String(r.origem_id)) ?? null : null,
        origin: "inforos", amount: valor, payment_method: s(r.forma_pgto),
        competence: dt(r.data_criacao) ?? dt(r.data_vencimento), due_date: dt(r.data_vencimento) ?? dt(r.data_criacao),
        paid_at: String(r.baixado) === "1" ? dt(r.data_pagamento) : null, legacy_data: r,
      };
    });
    for (let i = 0; i < linhas.length; i += 200) {
      const { error } = await db.from("finance_entries").upsert(linhas.slice(i, i + 200), { onConflict: "company_id,legacy_ref" });
      if (error) erros.push(error.message); else ok += Math.min(200, linhas.length - i);
    }
  } else if (tipo === "diff") {
    // compara registros do Inforos com o que já está gravado e devolve só os que mudaram ou faltam
    const { tabela, sub, campo, linhas } = registros as any;
    if (!["service_orders", "clients", "sales", "finance_entries", "equipment", "parts"].includes(tabela)) return NextResponse.json({ erro: "tabela inválida" }, { status: 400, headers: CORS });
    const estavel = (v: any): any => Array.isArray(v) ? v.map(estavel) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, estavel(v[k])])) : v;
    const hash = (o: any) => { const t = JSON.stringify(estavel(o)); let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return h; };
    const guardado = new Map<string, number>();
    for (let de = 0; ; de += 1000) {
      const { data } = await db.from(tabela).select("legacy_ref, legacy_data").eq("company_id", EMPRESA).not("legacy_ref", "is", null).order("legacy_ref").range(de, de + 999);
      for (const r of (data ?? []) as any[]) { const d = sub ? r.legacy_data?.[sub] : r.legacy_data; guardado.set(String(r.legacy_ref), d ? hash(d) : 0); }
      if ((data ?? []).length < 1000) break;
    }
    const mudaram: string[] = [], faltam: string[] = [];
    for (const r of linhas as any[]) {
      const ref = String(r[campo]);
      if (!guardado.has(ref)) faltam.push(ref);
      else if (guardado.get(ref) !== hash(r)) mudaram.push(ref);
    }
    return NextResponse.json({ ok: linhas.length, faltam, mudaram, naoNoInforos: [...guardado.keys()].filter((k) => !(linhas as any[]).some((r) => String(r[campo]) === k)).length }, { headers: CORS });
  } else if (tipo === "bruto") {
    // guarda registros crus de módulos pequenos (garantias, orçamentos, compras...) sem perder nada
    const { modulo, campo, linhas } = registros as any;
    const rows = (linhas as any[]).map((r) => ({ company_id: EMPRESA, module: String(modulo), legacy_ref: String(r[campo]), data: r }));
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await db.from("legacy_records").upsert(rows.slice(i, i + 100), { onConflict: "company_id,module,legacy_ref" });
      if (error) erros.push(error.message); else ok += Math.min(100, rows.length - i);
    }
  } else if (tipo === "anexos") {
    // baixa as fotos do Inforos (URL assinada, 1h) no servidor e guarda no storage
    const { data: oss } = await db.from("service_orders").select("id, legacy_ref").eq("company_id", EMPRESA).in("legacy_ref", (registros as any[]).map((r) => String(r.os)));
    const mo = new Map((oss ?? []).map((o: any) => [String(o.legacy_ref), o.id]));
    for (const r of registros as any[]) {
      try {
        const orderId = mo.get(String(r.os));
        if (!orderId) { erros.push(`OS ${r.os} não encontrada`); continue; }
        const resp = await fetch(r.url);
        if (!resp.ok) { erros.push(`OS ${r.os}: download ${resp.status}`); continue; }
        const buf = Buffer.from(await resp.arrayBuffer());
        const nome = decodeURIComponent(String(r.url).split("?")[0].split("/").pop() ?? "foto.jpeg");
        const path = `${EMPRESA}/${r.os}/${nome}`;
        const { error: up } = await db.storage.from("os-anexos").upload(path, buf, { contentType: resp.headers.get("content-type") ?? "image/jpeg", upsert: true });
        if (up) { erros.push(`OS ${r.os}: ${up.message}`); continue; }
        const { error } = await db.from("os_attachments").upsert({ company_id: EMPRESA, order_id: orderId, grupo: s(r.grupo), path, legacy_name: nome }, { onConflict: "company_id,path" });
        if (error) erros.push(`OS ${r.os}: ${error.message}`); else ok++;
      } catch (e: any) { erros.push(`OS ${r.os}: ${e.message}`); }
    }
  } else {
    return NextResponse.json({ erro: "tipo desconhecido" }, { status: 400, headers: CORS });
  }
  return NextResponse.json({ ok, ignorados, erros: erros.slice(0, 5) }, { headers: CORS });
}
