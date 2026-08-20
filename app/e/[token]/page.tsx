                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function PublicEquipment({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createClient();

  const { data: equipment, error } = await supabase
    .from("equipment")
    .select("*")
    .eq("code", token)
    .single();

  if (error || !equipment) {
    notFound();
  }

  return (
    <main
      style={{
        maxWidth: "800px",
        margin: "40px auto",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Infor Histórico</h1>

      <p style={{ color: "#666" }}>
        Histórico do equipamento
      </p>

      <hr />

      <section style={{ marginTop: "24px" }}>
        <h2>Equipamento</h2>

        <p>
          <strong>Código:</strong> {equipment.code}
        </p>

        <p>
          <strong>Marca:</strong> {equipment.brand || "-"}
        </p>

        <p>
          <strong>Modelo:</strong> {equipment.model || "-"}
        </p>

        <p>
          <strong>Número de série:</strong>{" "}
          {equipment.serial_number || "-"}
        </p>

        <p>
          <strong>Localização:</strong>{" "}
          {equipment.location || "-"}
        </p>

        <p>
          <strong>Status:</strong>{" "}
          {equipment.status || "-"}
        </p>
      </section>

      <hr style={{ margin: "30px 0" }} />

      <section>
        <h2>Histórico de manutenção</h2>

        <p style={{ color: "#666" }}>
          Nenhuma manutenção registrada.
        </p>
      </section>

      <footer
        style={{
          marginTop: "40px",
          paddingTop: "20px",
          borderTop: "1px solid #ddd",
          color: "#777",
          fontSize: "14px",
        }}
      >
        Infor Cartuchos — Infor Histórico
      </footer>
    </main>
  );
}
