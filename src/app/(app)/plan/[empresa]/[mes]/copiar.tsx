"use client";

import { useEffect, useState } from "react";

// Botón que copia un texto al portapapeles y avisa por 2 segundos.
export function BotonCopiar({
  texto,
  etiqueta = "Copiar",
  titulo,
  className = "",
}: {
  texto: string;
  etiqueta?: string;
  titulo?: string;
  className?: string;
}) {
  const [estado, setEstado] = useState<"listo" | "copiado" | "error">("listo");

  useEffect(() => {
    if (estado === "listo") return;
    const t = setTimeout(() => setEstado("listo"), 2000);
    return () => clearTimeout(t);
  }, [estado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("copiado");
    } catch {
      setEstado("error");
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      title={titulo ?? texto}
      disabled={texto.length === 0}
      className={`whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-40 ${
        estado === "copiado"
          ? "border-green-300 bg-green-50 text-green-800"
          : estado === "error"
            ? "border-red-300 bg-red-50 text-red-800"
            : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
      } ${className}`}
    >
      <span aria-live="polite">{estado === "copiado" ? "Copiado" : estado === "error" ? "No se pudo copiar" : etiqueta}</span>
    </button>
  );
}
