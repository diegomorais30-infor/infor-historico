// Cabeçalho padrão de documentos impressos: logo + dados da empresa (+ bloco à direita).
export type Empresa = { name?: string | null; document?: string | null; address?: string | null; email?: string | null; phone?: string | null; whatsapp?: string | null } | null;

export const CAMPOS_EMPRESA = "name, document, address, email, phone, whatsapp";

export default function CabecalhoEmpresa({ emp, linhaExtra, direita }: { emp: Empresa; linhaExtra?: React.ReactNode; direita?: React.ReactNode }) {
  const contato = [emp?.email ? `E-mail: ${emp.email}` : null, emp?.phone ?? emp?.whatsapp ? `Fone: ${emp?.phone ?? emp?.whatsapp}` : null].filter(Boolean).join(" - ");
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", borderTop: "1px solid #ddd", borderBottom: "1px solid #ddd", padding: "8px 0" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-infor.jpg" alt="" style={{ width: 110, height: 110, objectFit: "contain" }} />
      <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.45 }}>
        <div style={{ fontSize: 19, fontWeight: 600 }}>{emp?.name}</div>
        {emp?.document && <div>CNPJ: {emp.document}</div>}
        {emp?.address && <div>{emp.address}</div>}
        {contato && <div>{contato}</div>}
        {linhaExtra}
      </div>
      {direita && <div style={{ fontSize: 12.5, lineHeight: 1.5, minWidth: 170, textAlign: "right" }}>{direita}</div>}
    </div>
  );
}
