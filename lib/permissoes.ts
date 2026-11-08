// Áreas e níveis de acesso por pessoa. Espelha private.perm_nivel() do banco,
// que é quem realmente decide (aqui só escondemos menus e botões).
export const AREAS: { chave: string; nome: string; href: string }[] = [
  { chave: "chamados", nome: "Chamados", href: "/chamados" },
  { chave: "os", nome: "Ordens de serviço", href: "/os" },
  { chave: "equipamentos", nome: "Equipamentos e manutenções", href: "/equipamentos" },
  { chave: "clientes", nome: "Clientes", href: "/clientes" },
  { chave: "pecas", nome: "Estoque", href: "/estoque" },
  { chave: "leituras", nome: "Leituras", href: "/leituras" },
  { chave: "contratos", nome: "Contratos e faturas", href: "/contratos" },
  { chave: "financeiro", nome: "Financeiro e preços", href: "/financeiro" },
];

export const NIVEIS: Record<string, string> = { none: "Sem acesso", read: "Só ver", edit: "Ver e editar" };

export type Nivel = "none" | "read" | "edit";

export function nivelDe(role: string | null | undefined, permissions: any, area: string): Nivel {
  if (role === "admin") return "edit";
  const v = permissions && typeof permissions === "object" ? permissions[area] : undefined;
  if (v === "none" || v === "read" || v === "edit") return v;
  if (role === "manager") return "edit";
  return area === "contratos" || area === "financeiro" ? "none" : "edit";
}

export const podeVer = (role: any, perms: any, area: string) => nivelDe(role, perms, area) !== "none";
export const podeEditar = (role: any, perms: any, area: string) => nivelDe(role, perms, area) === "edit";

// Lê os campos perm_<area> do formulário; só guarda o que foge do padrão do perfil.
export function lerPermissoes(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of AREAS) {
    const v = String(formData.get("perm_" + a.chave) || "");
    if (v === "none" || v === "read" || v === "edit") out[a.chave] = v;
  }
  return out;
}
