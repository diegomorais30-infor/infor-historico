// Busca todas as linhas de uma consulta Supabase (limite de 1000 por página).
export async function tudo<T = any>(montar: () => any): Promise<T[]> {
  const saida: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data } = await montar().range(de, de + 999);
    saida.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return saida;
}
