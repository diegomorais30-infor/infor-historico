import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export default async function Equipamentos(){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect("/login");
 const {data}=await supabase.from("equipment").select("id,code,brand,model,serial_number,location,status,clients(name)").order("created_at",{ascending:false});
 return <main className="wrap"><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"end",marginBottom:18}}><div><h1 className="title">Equipamentos</h1><p className="muted">Máquinas cadastradas na Infor Cartuchos.</p></div><Link className="btn primary" href="/equipamentos/novo">+ Novo equipamento</Link></div>
 <section className="card"><table className="table"><thead><tr><th>Código</th><th>Equipamento</th><th>Cliente</th><th>Nº série</th><th>Local</th><th>Status</th></tr></thead><tbody>
 {(data??[]).map((e:any)=><tr key={e.id}><td><Link href={`/equipamentos/${e.id}`} style={{color:"var(--blue)",fontWeight:800}}>{e.code}</Link></td><td>{e.brand} {e.model}</td><td>{e.clients?.name??"—"}</td><td>{e.serial_number??"—"}</td><td>{e.location??"—"}</td><td><span className="badge">{e.status}</span></td></tr>)}
 {!data?.length&&<tr><td colSpan={6} className="muted">Nenhum equipamento cadastrado.</td></tr>}
 </tbody></table></section></main>
}
