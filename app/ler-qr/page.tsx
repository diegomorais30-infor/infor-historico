import Leitor from "./leitor";
import { getContexto } from "@/lib/contexto";

export const metadata = { title: "Ler QR Code" };

export default async function LerQR() {
  await getContexto();
  return (
    <main className="wrap" style={{ maxWidth: 560 }}>
      <h1 className="title">Ler QR Code</h1>
      <p className="muted">Aponte a câmera para a etiqueta da impressora para abrir a ficha e o histórico.</p>
      <Leitor />
    </main>
  );
}
