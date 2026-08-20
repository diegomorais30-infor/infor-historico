import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Dashboard(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) redirect("/login");
 const [{count:eqCount},{count:clCount},{count:mtCount}]=await Promise.all([
  supabase.from("equipment").select("*",{count:"exact",head:true}),
  supabase.from("clients").select("*",{count:"exact",head:true}),
  supabase.from("maintenance").select("*",{count:"exact",head:true})
 ]);
 const {data:recent}=await supabase.from("equipment").select("id,code,brand,model,status,clients(name)").order("created_at",{ascending:false}).limit(5);
 return <main className="wrap">
  <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"end",marginBottom:18}}><div><h1 className="title">Dashboard</h1><p className="muted">Bem-vindo ao Infor Histórico.</p></div><Link className="btn primary" href="/equipamentos/novo">+ Novo equipamento</Link></div>
  <div className="grid g4">
   <div className="card"><div className="muted">Equipamentos</div><div className="stat">{eqCount??0}</div></div>
   <div className="card"><div className="muted">Clientes</div><div className="stat">{clCount??0}</div></div>
   <div className="card"><div className="muted">Manutenções</div><div className="stat">{mtCount??0}</div></div>
   <div className="card"><div className="muted">Perfil</div><div className="stat" style={{fontSize:20}}>Administrador</div></div>
  </div>
  <nav className="nav"><Link className="btn secondary" href="/equipamentos">Equipamentos</Link><Link className="btn secondary" href="/clientes">Clientes</Link></nav>
  <section className="card"><h2>Equipamentos recentes</h2>
   <table className="table"><thead><tr><th>Código</th><th>Equipamento</th><th>Cliente</th><th>Status</th></tr></thead><tbody>
   {(recent??[]).map((e:any)=><tr key={e.id}><td><Link href={`/equipamentos/${e.id}`} style={{color:"var(--blue)",fontWeight:800}}>{e.code}</Link></td><td>{e.brand} {e.model}</td><td>{e.clients?.name??"—"}</td><td><span className="badge">{e.status}</span></td></tr>)}
   {!recent?.length&&<tr><td colSpan={4} className="muted">Nenhum equipamento cadastrado ainda.</td></tr>}
   </tbody></table>
  </section>
 </main>
}
