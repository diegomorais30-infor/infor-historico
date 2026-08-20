import "./globals.css";
import Link from "next/link";

export const metadata = { title: "Infor Histórico", description: "Gestão de equipamentos e manutenções — Infor Cartuchos" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>
    <header className="top"><div className="wrap" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}>
      <Link href="/dashboard" className="brand"><span className="circles"><i className="c"/><i className="c"/><i className="c"/></span><span>Infor Histórico</span></Link>
      <span className="muted" style={{fontSize:13}}>Infor Cartuchos · V1</span>
    </div></header>
    {children}
  </body></html>;
}
