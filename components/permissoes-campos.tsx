import { AREAS, NIVEIS } from "@/lib/permissoes";

// Uma lista por área: "padrão do perfil" não grava nada; as demais opções fixam o nível.
export default function PermissoesCampos({ atuais }: { atuais?: Record<string, string> | null }) {
  return (
    <div className="grid g3" style={{ gap: 8 }}>
      {AREAS.map((a) => (
        <label key={a.chave} className="field" style={{ fontSize: 13 }}>
          {a.nome}
          <select name={"perm_" + a.chave} defaultValue={atuais?.[a.chave] ?? ""}>
            <option value="">Padrão do perfil</option>
            {Object.entries(NIVEIS).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
