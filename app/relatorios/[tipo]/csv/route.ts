import { NextRequest } from "next/server";
import { getContexto } from "@/lib/contexto";
import { podeVer } from "@/lib/permissoes";
import { lerFiltros, RELATORIOS, semValores, SO_FINANCEIRO } from "@/lib/relatorios";

export async function GET(req: NextRequest, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  const cfg = RELATORIOS[tipo];
  if (!cfg) return new Response("Relatório não encontrado", { status: 404 });
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { supabase, perfil } = await getContexto();
  const verFin = podeVer(perfil?.role, (perfil as any)?.permissions, "financeiro");
  if (!verFin && SO_FINANCEIRO.includes(tipo)) return new Response("Sem permissão", { status: 403 });
  const bruto = await cfg.carregar(supabase, lerFiltros(sp));
  const r = verFin ? bruto : semValores(bruto);
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = "﻿" + [r.cols, ...r.rows].map((l) => l.map(esc).join(";")).join("\r\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="relatorio-${tipo}.csv"` } });
}
