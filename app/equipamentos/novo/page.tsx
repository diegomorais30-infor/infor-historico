"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { vazioParaNulo } from "@/lib/format";

const CAMPOS: [string, string][] = [
  ["brand", "Marca"],
  ["model", "Modelo"],
  ["serial_number", "Nº de série"],
  ["asset_tag", "Patrimônio"],
  ["location", "Localização"],
  ["installation_date", "Data de instalação"],
];

export default function NovoEquipamento() {
  const router = useRouter();
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState<Record<string, string>>({
    client_id: "",
    equipment_type: "Impressora",
    brand: "",
    model: "",
    serial_number: "",
    asset_tag: "",
    location: "",
    installation_date: "",
  });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    createClient()
      .from("clients")
      .select("id,name")
      .eq("active", true)
      .order("name")
      .then(({ data }) => setClients(data ?? []));
  }, []);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!form.client_id) {
      setMsg("Cadastre um cliente antes de criar o equipamento.");
      return;
    }
    setLoading(true);
    // Campos vazios viram null: data vazia ("") derrubava o cadastro no banco.
    const { data, error } = await createClient()
      .from("equipment")
      .insert(vazioParaNulo(form))
      .select("id")
      .single();
    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }
    router.push(`/equipamentos/${data.id}`);
    router.refresh();
  }

  return (
    <main className="wrap">
      <h1 className="title">Novo equipamento</h1>
      <p className="muted">O código IC-EQP e o QR code são gerados automaticamente.</p>
      <form onSubmit={salvar} className="card grid g2" style={{ marginTop: 18 }}>
        {CAMPOS.map(([k, label]) => (
          <label className="field" key={k}>
            {label}
            <input
              type={k === "installation_date" ? "date" : "text"}
              value={form[k]}
              onChange={(e) => set(k, e.target.value)}
            />
          </label>
        ))}
        <label className="field">
          Tipo
          <select value={form.equipment_type} onChange={(e) => set("equipment_type", e.target.value)}>
            <option>Impressora</option>
            <option>Multifuncional</option>
            <option>Computador</option>
            <option>Scanner</option>
            <option>Outro</option>
          </select>
        </label>
        <label className="field">
          Cliente
          <select required value={form.client_id} onChange={(e) => set("client_id", e.target.value)}>
            <option value="">Selecione...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
            {loading ? "Salvando..." : "Cadastrar equipamento"}
          </button>
        </div>
      </form>
    </main>
  );
}
