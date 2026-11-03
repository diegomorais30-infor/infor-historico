"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login(){
 const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
 const router=useRouter();
 async function submit(e:React.FormEvent){e.preventDefault();setLoading(true);setError("");const supabase=createClient();const {error}=await supabase.auth.signInWithPassword({email,password});if(error){setError(error.message);setLoading(false);return}router.push("/dashboard");router.refresh();}
 return <main className="login"><div className="card">
   <div className="brand"><span className="circles"><i className="c"/><i className="c"/><i className="c"/></span><span>Infor Histórico</span></div>
   <h1 className="title" style={{marginTop:25}}>Entrar</h1><p className="muted">Gestão de equipamentos e manutenções.</p>
   <form onSubmit={submit} style={{display:"grid",gap:14,marginTop:20}}>
    <label className="field">E-mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
    <label className="field">Senha<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>
    {error&&<div className="error">{error}</div>}
    <button className="btn primary" disabled={loading}>{loading?"Entrando...":"Entrar"}</button>
    <Link href="/cadastro" className="muted" style={{textAlign:"center"}}>Criar conta</Link>
   </form>
 </div></main>
}
