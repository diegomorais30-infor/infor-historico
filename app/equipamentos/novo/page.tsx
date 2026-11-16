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
  // Equipamento já cadastrado em outro cliente (mesmo patrimônio ou nº de série): oferece transferir.
  const [existente, setExistente] = useState<any>(null);

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
    setExistente(null);
    const sb = createClient();
    const filtros: string[] = [];
    if (form.asset_tag.trim()) filtros.push(`asset_tag.eq.${form.asset_tag.trim()}`);
    if (form.serial_number.trim()) filtros.push(`serial_number.eq.${form.serial_number.trim()}`);
    if (filtros.length) {
      const { data: ja } = await sb
        .from("equipment")
        .select("id, code, asset_tag, serial_number, brand, model, client_id, clients(name)")
        .or(filtros.join(","))
        .neq("status", "inactive")
        .neq("client_id", form.client_id)
        .limit(1);
      if (ja && ja.length) {
        setExistente(ja[0]);
        setLoading(false);
        return;
      }
    }
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

  async function transferir() {
    if (!existente) return;
    setLoading(true);
    setMsg("");
    const sb = createClient();
    const { data: ctr } = await sb.from("contracts").select("id").eq("client_id", form.client_id).eq("status", "active");
    const contrato = ctr && ctr.length === 1 ? ctr[0].id : null;
    const upd: Record<string, any> = {
      client_id: form.client_id,
      contract_id: contrato,
      vinculo: contrato ? "contrato" : "avulso",
      status: "active",
    };
    if (form.location.trim()) upd.location = form.location.trim();
    if (form.installation_date) upd.installation_date = form.installation_date;
    const { error } = await sb.from("equipment").update(upd).eq("id", existente.id);
    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }
    router.push(`/equipamentos/${existente.id}`);
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
        {existente && (
          <div className="card" style={{ gridColumn: "1/-1", borderColor: "#f59e0b" }}>
            <b>Este equipamento já está cadastrado em outro cliente.</b>
            <p style={{ margin: "6px 0" }}>
              {existente.code} · {existente.brand} {existente.model} · patrimônio {existente.asset_tag ?? "—"} · série {existente.serial_number ?? "—"}
              <br />
              Cliente atual: <b>{existente.clients?.name}</b>
            </p>
            <p className="muted" style={{ margin: "6px 0" }}>
              Se ele saiu de lá e foi para o cliente escolhido acima, transfira: o código, o QR code e o histórico são mantidos.
            </p>
            <button type="button" className="btn primary" disabled={loading} onClick={transferir}>
              Transferir para este cliente
            </button>
          </div>
        )}
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
