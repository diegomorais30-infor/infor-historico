import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContexto } from "@/lib/contexto";
import { createClient } from "@/lib/supabase/server";

async function salvar(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const id = String(fd.get("id") || "");
  const title = String(fd.get("title") || "").trim();
  if (!title) redirect("/checklist?erro=" + encodeURIComponent("Informe o nome do checklist."));
  const dados = {
    title,
    question: String(fd.get("question") || "").trim() || null,
    options: String(fd.get("options") || "").split("\n").map((x) => x.trim()).filter(Boolean),
    required: fd.get("required") === "on",
    hidden: fd.get("hidden") === "on",
  };
  const { error } = id ? await supabase.from("checklist_templates").update(dados).eq("id", id) : await supabase.from("checklist_templates").insert(dados);
  if (error) redirect("/checklist?erro=" + encodeURIComponent(error.message));
  revalidatePath("/checklist");
  redirect("/checklist");
}

async function excluir(fd: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("checklist_templates").delete().eq("id", String(fd.get("id")));
  revalidatePath("/checklist");
  redirect("/checklist");
}

export default async function Checklist({ searchParams }: { searchParams: Promise<{ editar?: string; novo?: string; erro?: string }> }) {
  const { editar, novo, erro } = await searchParams;
  const { supabase } = await getContexto();
  const { data } = await supabase.from("checklist_templates").select("id, title, question, options, required, hidden").order("sort").order("title");
  const lista = (data ?? []) as any[];
  const ed = lista.find((c) => c.id === editar);
  const mostrarForm = !!ed || novo === "1";

  return (
    <main className="wrap">
      <h1 className="title">Checklist</h1>
      <p className="muted">Modelos de checklist usados nas OS: cada um tem uma pergunta e suas opções de conferência</p>
      {erro && <div className="error" style={{ margin: "10px 0" }}>{erro}</div>}
      {!mostrarForm && <p><Link href="/checklist?novo=1" className="btn primary">+ Novo checklist</Link></p>}
      {mostrarForm && (
        <form action={salvar} className="card grid g2" style={{ margin: "12px 0" }} key={ed?.id ?? "novo"}>
          <input type="hidden" name="id" value={ed?.id ?? ""} />
          <label className="field">Nome do checklist<input name="title" required defaultValue={ed?.title ?? ""} /></label>
          <label className="field">Texto da pergunta<input name="question" defaultValue={ed?.question ?? ""} /></label>
          <label className="field" style={{ gridColumn: "1/-1" }}>Opções (uma por linha)
            <textarea name="options" rows={8} defaultValue={(ed?.options ?? []).join("\n")} />
          </label>
          <label><input type="checkbox" name="required" defaultChecked={ed?.required ?? false} /> Obrigatória</label>
          <label><input type="checkbox" name="hidden" defaultChecked={ed?.hidden ?? false} /> Ocultar nas impressões</label>
          <div>
            <button className="btn primary">Salvar</button>{" "}
            <Link href="/checklist" className="btn secondary">Voltar</Link>
          </div>
        </form>
      )}
      {lista.map((c) => (
        <section key={c.id} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>{c.title}</h3>
            <div>
              <Link href={`/checklist?editar=${c.id}`} className="btn secondary">Editar</Link>{" "}
              <form action={excluir} style={{ display: "inline" }}><input type="hidden" name="id" value={c.id} /><button className="btn secondary">Excluir</button></form>
            </div>
          </div>
          <p className="muted" style={{ margin: "4px 0" }}>
            {c.question ?? "—"} · Múltipla escolha · {c.required ? "Obrigatória" : "Opcional"}{c.hidden ? " · Oculta nas impressões" : ""}
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>{(c.options ?? []).map((o: string, i: number) => <li key={i}>{o}</li>)}</ul>
        </section>
      ))}
      {!lista.length && <p className="muted">Nenhum checklist cadastrado.</p>}
    </main>
  );
}
