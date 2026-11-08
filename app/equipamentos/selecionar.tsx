"use client";

export default function SelecionarTodos() {
  return (
    <input
      type="checkbox"
      aria-label="Selecionar todos"
      onChange={(ev) => {
        const form = ev.currentTarget.closest("form");
        form?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((c) => (c.checked = ev.currentTarget.checked));
      }}
    />
  );
}
