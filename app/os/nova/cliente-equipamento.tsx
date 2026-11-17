"use client";
import { useState } from "react";
import SeletorCliente from "@/components/seletor-cliente";

type Cli = { id: string; name: string; document?: string | null };
type Eq = { id: string; code: string; brand: string | null; model: string | null; client_id: string };

// Escolhe o cliente e mostra só os equipamentos desse cliente.
export default function ClienteEquipamento({ clientes, equipamentos, clienteInicial, equipamentoInicial }: { clientes: Cli[]; equipamentos: Eq[]; clienteInicial: string; equipamentoInicial: string }) {
  const [cliente, setCliente] = useState(clienteInicial);
  const lista = equipamentos.filter((e) => e.client_id === cliente);
  return (
    <>
      <div className="field">
        Cliente
        <SeletorCliente clientes={clientes} inicial={clienteInicial} onChange={setCliente} />
      </div>
      <label className="field">
        Equipamento (opcional)
        <select key={cliente} name="equipment_id" defaultValue={lista.some((e) => e.id === equipamentoInicial) ? equipamentoInicial : ""}>
          <option value="">{cliente ? (lista.length ? "Sem equipamento" : "Este cliente não tem equipamento cadastrado") : "Escolha o cliente primeiro"}</option>
          {lista.map((e) => (
            <option key={e.id} value={e.id}>
              {e.code} · {e.brand ?? ""} {e.model ?? ""}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
