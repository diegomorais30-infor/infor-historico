// Campos completos do cadastro de cliente (usado em "novo" e "editar").
export const CAMPOS_CLIENTE = ["name", "trade_name", "document", "contact_name", "phone", "email", "address", "city", "state", "notes"] as const;

export function lerCliente(fd: FormData) {
  const v = (k: string) => String(fd.get(k) || "").trim() || null;
  return {
    name: String(fd.get("name") || "").trim(),
    trade_name: v("trade_name"),
    document: v("document"),
    contact_name: v("contact_name"),
    phone: v("phone"),
    email: v("email"),
    address: v("address"),
    city: v("city"),
    state: v("state"),
    notes: v("notes"),
  };
}

export function CamposCliente({ c }: { c?: any }) {
  const d = (k: string) => c?.[k] ?? "";
  return (
    <>
      <label className="field">Nome / Razão social
        <input name="name" required defaultValue={d("name")} placeholder="Nome do cliente ou empresa" />
      </label>
      <label className="field">Nome fantasia
        <input name="trade_name" defaultValue={d("trade_name")} />
      </label>
      <label className="field">CNPJ / CPF
        <input name="document" defaultValue={d("document")} />
      </label>
      <label className="field">Pessoa de contato
        <input name="contact_name" defaultValue={d("contact_name")} />
      </label>
      <label className="field">Telefone / WhatsApp
        <input name="phone" defaultValue={d("phone")} placeholder="(38) 99999-9999" />
      </label>
      <label className="field">E-mail
        <input name="email" type="email" defaultValue={d("email")} />
      </label>
      <label className="field">Endereço (rua, número, bairro, CEP)
        <input name="address" defaultValue={d("address")} />
      </label>
      <label className="field">Cidade
        <input name="city" defaultValue={d("city")} placeholder="Ex.: Montes Claros" />
      </label>
      <label className="field">UF
        <input name="state" maxLength={2} defaultValue={d("state")} placeholder="MG" />
      </label>
      <label className="field">Observações
        <textarea name="notes" rows={3} defaultValue={d("notes")} />
      </label>
    </>
  );
}
