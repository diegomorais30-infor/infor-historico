import BuscarCnpj from "@/components/buscar-cnpj";

export const TIPOS_CLIENTE: [string, string][] = [["cliente", "Cliente"], ["contrato", "Contrato"], ["parceiro", "Parceiro"], ["fornecedor", "Fornecedor"], ["garantia", "Garantia"], ["fabricante", "Fabricante"], ["remoto", "Remoto"], ["visita", "Visita"]];
export const ORIGENS_CLIENTE: [string, string][] = [["cliente", "Cliente"], ["loja", "Loja"], ["indicacao", "Indicação"], ["irrelevante", "Irrelevante"]];

// Campos completos do cadastro de cliente (usado em "novo" e "editar").
export const CAMPOS_CLIENTE = ["name", "trade_name", "document", "contact_name", "phone", "email", "mobile", "cep", "address", "street_number", "complement", "neighborhood", "city", "state", "state_registration", "municipal_registration", "birthday", "notes"] as const;

export function lerCliente(fd: FormData) {
  const v = (k: string) => String(fd.get(k) || "").trim() || null;
  return {
    name: String(fd.get("name") || "").trim(),
    trade_name: v("trade_name"),
    document: v("document"),
    contact_name: v("contact_name"),
    phone: v("phone"),
    email: v("email"),
    mobile: v("mobile"),
    cep: v("cep"),
    address: v("address"),
    street_number: v("street_number"),
    complement: v("complement"),
    neighborhood: v("neighborhood"),
    state_registration: v("state_registration"),
    municipal_registration: v("municipal_registration"),
    birthday: v("birthday"),
    city: v("city"),
    state: v("state"),
    notes: v("notes"),
    person_type: v("person_type"),
    client_type: v("client_type") ?? "cliente",
    is_contract: v("client_type") === "contrato",
    origin: v("origin"),
    municipal_code: v("municipal_code"),
    iss_retido: fd.get("iss_retido") === "sim",
    active: fd.get("situacao") !== "bloqueado",
  };
}

export function CamposCliente({ c }: { c?: any }) {
  const d = (k: string) => c?.[k] ?? "";
  return (
    <>
      <div className="field" style={{ gridColumn: "1/-1" }}>
        CNPJ / CPF
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input name="document" defaultValue={d("document")} style={{ maxWidth: 220 }} />
          <BuscarCnpj />
        </div>
      </div>
      <label className="field">Nome / Razão social
        <input name="name" required defaultValue={d("name")} placeholder="Nome do cliente ou empresa" />
      </label>
      <label className="field">Nome fantasia
        <input name="trade_name" defaultValue={d("trade_name")} />
      </label>
      <div className="field">Pessoa
        <div style={{ display: "flex", gap: 14 }}>
          <label><input type="radio" name="person_type" value="pf" defaultChecked={d("person_type") !== "pj"} style={{ width: "auto" }} /> Física</label>
          <label><input type="radio" name="person_type" value="pj" defaultChecked={d("person_type") === "pj"} style={{ width: "auto" }} /> Jurídica</label>
        </div>
      </div>
      <div className="field" style={{ gridColumn: "1/-1" }}>Tipo
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {TIPOS_CLIENTE.map(([v, n]) => (
            <label key={v}><input type="radio" name="client_type" value={v} defaultChecked={(d("client_type") || "cliente") === v} style={{ width: "auto" }} /> {n}</label>
          ))}
        </div>
      </div>
      <label className="field">Origem
        <select name="origin" defaultValue={d("origin") || "cliente"}>
          {ORIGENS_CLIENTE.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
      </label>
      <label className="field">Pessoa de contato
        <input name="contact_name" defaultValue={d("contact_name")} />
      </label>
      <label className="field">Telefone / WhatsApp
        <input name="phone" defaultValue={d("phone")} placeholder="(38) 99999-9999" />
      </label>
      <label className="field">Celular
        <input name="mobile" defaultValue={d("mobile")} />
      </label>
      <label className="field">E-mail
        <input name="email" type="email" defaultValue={d("email")} />
      </label>
      <label className="field">CEP
        <input name="cep" defaultValue={d("cep")} />
      </label>
      <label className="field">Endereço (rua)
        <input name="address" defaultValue={d("address")} />
      </label>
      <label className="field">Número
        <input name="street_number" defaultValue={d("street_number")} />
      </label>
      <label className="field">Complemento
        <input name="complement" defaultValue={d("complement")} />
      </label>
      <label className="field">Bairro
        <input name="neighborhood" defaultValue={d("neighborhood")} />
      </label>
      <label className="field">Cidade
        <input name="city" defaultValue={d("city")} placeholder="Ex.: Montes Claros" />
      </label>
      <label className="field">UF
        <input name="state" maxLength={2} defaultValue={d("state")} placeholder="MG" />
      </label>
      <label className="field">Inscrição estadual
        <input name="state_registration" defaultValue={d("state_registration")} />
      </label>
      <label className="field">Inscrição municipal
        <input name="municipal_registration" defaultValue={d("municipal_registration")} />
      </label>
      <label className="field">Aniversário
        <input name="birthday" type="date" defaultValue={d("birthday")} />
      </label>
      <label className="field">Código município (IBGE)
        <input name="municipal_code" defaultValue={d("municipal_code")} />
      </label>
      <div className="field">ISS retido na fonte
        <div style={{ display: "flex", gap: 14 }}>
          <label><input type="radio" name="iss_retido" value="sim" defaultChecked={!!c?.iss_retido} style={{ width: "auto" }} /> Sim</label>
          <label><input type="radio" name="iss_retido" value="nao" defaultChecked={!c?.iss_retido} style={{ width: "auto" }} /> Não</label>
        </div>
      </div>
      <div className="field">Situação
        <div style={{ display: "flex", gap: 14 }}>
          <label><input type="radio" name="situacao" value="ativo" defaultChecked={c?.active !== false} style={{ width: "auto" }} /> Ativo</label>
          <label><input type="radio" name="situacao" value="bloqueado" defaultChecked={c?.active === false} style={{ width: "auto" }} /> Bloqueado</label>
        </div>
      </div>
      <label className="field">Observações
        <textarea name="notes" rows={3} defaultValue={d("notes")} />
      </label>
    </>
  );
}
