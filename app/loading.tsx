import { LogoIcone } from "@/components/logo";

export default function Carregando() {
  return (
    <div className="carregando" role="status" aria-live="polite">
      <div className="carregando-logo"><LogoIcone size={72} /></div>
      <div className="carregando-texto">Carregando…</div>
    </div>
  );
}
