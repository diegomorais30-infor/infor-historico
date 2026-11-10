// Backup completo do InforGest (Supabase) em arquivos JSON compactados.
// Uso:  node backup.mjs "<pasta-de-destino>"
// Variáveis de ambiente: SUPABASE_URL (https://xvwrmlqkmncgqakebikj.supabase.co) e SUPABASE_SERVICE_ROLE_KEY
// Guarda os últimos 30 dias + o backup do dia 1 de cada mês. Sem dependências externas (Node 18+).
import { mkdirSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const URL = (process.env.SUPABASE_URL || "https://xvwrmlqkmncgqakebikj.supabase.co").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DESTINO = process.argv[2];
if (!KEY || !DESTINO) {
  console.error('Uso: SUPABASE_SERVICE_ROLE_KEY=... node backup.mjs "<pasta>"');
  process.exit(1);
}

const TABELAS = [
  "companies","profiles","company_invites","clients","suppliers","equipment","contracts","contract_month_terms",
  "service_orders","service_order_items","item_prices","os_attachments","service_requests","sales","sale_items",
  "finance_entries","order_finance","invoices","parts","part_prices","part_groups","catalog_services","service_prices",
  "price_lists","kits","stock_movements","transfers","tags","checklist_items","maintenance","maintenance_parts",
  "maintenance_files","meter_readings","tasks","painel_chamados","push_subscriptions","legacy_records",
];

const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
const nome = hoje.toISOString().slice(0, 10);
const pasta = join(DESTINO, nome);
mkdirSync(pasta, { recursive: true });

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const resumo = {};
let erros = 0;

for (const t of TABELAS) {
  try {
    const linhas = [];
    for (let de = 0; ; de += 1000) {
      const pedir = (ordem) => fetch(`${URL}/rest/v1/${t}?select=*${ordem}`, {
        headers: { ...H, Range: `${de}-${de + 999}`, "Range-Unit": "items" },
      });
      let r = await pedir("&order=id");
      if (r.status === 400) r = await pedir(""); // tabela sem coluna id
      if (r.status === 404) throw new Error("tabela não encontrada");
      if (!r.ok && r.status !== 206) throw new Error(`HTTP ${r.status} ${await r.text()}`);
      const lote = await r.json();
      linhas.push(...lote);
      if (lote.length < 1000) break;
    }
    writeFileSync(join(pasta, `${t}.json.gz`), gzipSync(JSON.stringify(linhas)));
    resumo[t] = linhas.length;
  } catch (e) {
    erros++;
    resumo[t] = `ERRO: ${e.message}`;
  }
}
writeFileSync(join(pasta, "_resumo.json"), JSON.stringify({ data: new Date().toISOString(), erros, resumo }, null, 2));

// Retenção: 30 dias + dia 1 de cada mês
const limite = new Date(hoje); limite.setDate(limite.getDate() - 30);
for (const d of readdirSync(DESTINO)) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d.endsWith("-01")) continue;
  if (new Date(d) < limite) rmSync(join(DESTINO, d), { recursive: true, force: true });
}
console.log(`Backup ${nome}: ${Object.keys(resumo).length} tabelas, ${erros} erro(s).`);
process.exit(erros ? 2 : 0);
