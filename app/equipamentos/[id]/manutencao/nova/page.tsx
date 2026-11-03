"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TIPOS_MANUTENCAO, vazioParaNulo } from "@/lib/format";

type Peca = { id: string; name: string; code: string | null; stock_quantity: number };
type LinhaPeca = { part_id: string; quantity: string };

function nomeSeguro(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.\-]+/g, "_");
}

export default function NovaManutencao() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [linhas, setLinhas] = useState<LinhaPeca[]>([]);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [form, setForm] = useState<Record<string, string>>({
    maintenance_type: "corrective",
    service_date: new Date().toISOString().slice(0, 10),
    os_number: "",
    problem_reported: "",
    diagnosis: "",
    service_performed: "",
    observations: "",
    next_preventive_date: "",
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    createClient()
      .from("parts")
      .select("id,name,code,stock_quantity")
      .eq("active", true)
      .order("name")
      .then(({ data }) => setPecas((data as Peca[]) ?? []));
  }, []);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setLinha(i: number, campo: keyof LinhaPeca, valor: string) {
    setLinhas((ls) => ls.map((l, n) => (n === i ? { ...l, [campo]: valor } : l)));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    const s = createClient();

    const {
      data: { user },
    } = await s.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: m, error } = await s
      .from("maintenance")
      .insert({ ...vazioParaNulo(form), equipment_id: id, technician_id: user.id, created_by: user.id })
      .select("id, company_id")
      .single();
    if (error || !m) {
      setMsg(error?.message ?? "Não foi possível salvar a manutenção.");
      setLoading(false);
      return;
    }

    const avisos: string[] = [];

    const usadas = linhas
      .filter((l) => l.part_id)
      .map((l) => ({ maintenance_id: m.id, part_id: l.part_id, quantity: Number(l.quantity) || 1 }));
    if (usadas.length) {
      const { error: errPecas } = await s.from("maintenance_parts").insert(usadas);
      if (errPecas) avisos.push(`Peças não registradas: ${errPecas.message}`);
    }

    for (const f of arquivos) {
      const caminho = `${m.company_id}/${m.id}/${Date.now()}-${nomeSeguro(f.name)}`;
      const { error: errUp } = await s.storage.from("maintenance-files").upload(caminho, f, { contentType: f.type });
      if (errUp) {
        avisos.push(`Arquivo ${f.name}: ${errUp.message}`);
        continue;
      }
      await s.from("maintenance_files").insert({
        maintenance_id: m.id,
        storage_path: caminho,
        file_name: f.name,
        file_type: f.type,
        uploaded_by: user.id,
      });
    }

    if (form.next_preventive_date) {
      await s.from("equipment").update({ next_preventive_date: form.next_preventive_date }).eq("id", id);
    }

    if (avisos.length) {
      setMsg(`Manutenção salva, mas: ${avisos.join(" · ")}`);
      setLoading(false);
      return;
    }
    router.push(`/equipamentos/${id}`);
    router.refresh();
  }

  return (
    <main className="wrap" style={{ maxWidth: 820 }}>
      <Link href={`/equipamentos/${id}`} className="muted">
        ← Voltar ao equipamento
      </Link>
      <h1 className="title" style={{ marginTop: 12 }}>
        Registrar manutenção
      </h1>

      <form onSubmit={salvar} className="card grid g2" style={{ marginTop: 18 }}>
        <label className="field">
          Tipo
          <select value={form.maintenance_type} onChange={(e) => set("maintenance_type", e.target.value)}>
            {Object.entries(TIPOS_MANUTENCAO).map(([valor, nome]) => (
              <option key={valor} value={valor}>
                {nome}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Data do serviço
          <input type="date" required value={form.service_date} onChange={(e) => set("service_date", e.target.value)} />
        </label>
        <label className="field">
          Nº da O.S.
          <input value={form.os_number} onChange={(e) => set("os_number", e.target.value)} />
        </label>
        <label className="field">
          Próxima preventiva
          <input
            type="date"
            value={form.next_preventive_date}
            onChange={(e) => set("next_preventive_date", e.target.value)}
          />
        </label>
        <label className="field" style={{ gridColumn: "1/-1" }}>
          Problema relatado
          <textarea rows={2} value={form.problem_reported} onChange={(e) => set("problem_reported", e.target.value)} />
        </label>
        <label className="field" style={{ gridColumn: "1/-1" }}>
          Diagnóstico
          <textarea rows={2} value={form.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} />
        </label>
        <label className="field" style={{ gridColumn: "1/-1" }}>
          Serviço realizado
          <textarea
            rows={3}
            required
            value={form.service_performed}
            onChange={(e) => set("service_performed", e.target.value)}
          />
        </label>
        <label className="field" style={{ gridColumn: "1/-1" }}>
          Observações
          <textarea rows={2} value={form.observations} onChange={(e) => set("observations", e.target.value)} />
        </label>

        <div style={{ gridColumn: "1/-1" }}>
          <b>Peças usadas</b>
          <p className="muted" style={{ margin: "4px 0 10px" }}>
            O estoque da peça baixa automaticamente.
          </p>
          {linhas.map((l, i) => (
            <div key={i} className="partrow">
              <select value={l.part_id} onChange={(e) => setLinha(i, "part_id", e.target.value)}>
                <option value="">Selecione a peça...</option>
                {pecas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.code ? ` (${p.code})` : ""} — estoque {p.stock_quantity}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                step="1"
                value={l.quantity}
                onChange={(e) => setLinha(i, "quantity", e.target.value)}
                aria-label="Quantidade"
              />
              <button type="button" className="btn danger" onClick={() => setLinhas((ls) => ls.filter((_, n) => n !== i))}>
                Remover
              </button>
            </div>
          ))}
          <button type="button" className="btn secondary" onClick={() => setLinhas((ls) => [...ls, { part_id: "", quantity: "1" }])}>
            + Adicionar peça
          </button>
        </div>

        <label className="field" style={{ gridColumn: "1/-1" }}>
          Fotos e PDFs (até 10 MB cada)
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
          />
        </label>

        {msg && (
          <div className="error" style={{ gridColumn: "1/-1" }}>
            {msg}
          </div>
        )}
        <div style={{ gridColumn: "1/-1", display: "flex", gap: 8 }}>
          <button type="button" className="btn secondary" onClick={() => router.back()}>
            Cancelar
          </button>
          <button className="btn primary" disabled={loading}>
            {loading ? "Salvando..." : "Salvar manutenção"}
          </button>
        </div>
      </form>
    </main>
  );
}
