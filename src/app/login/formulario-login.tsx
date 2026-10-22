"use client";

import { useActionState } from "react";
import { accionLogin, type EstadoLogin } from "./actions";

const inicial: EstadoLogin = { paso: "correo", correo: "" };

const campo =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900";
const botonPrincipal =
  "w-full rounded-md bg-neutral-900 px-3 py-2 font-medium text-white hover:bg-neutral-700 disabled:opacity-50";
const botonEnlace =
  "text-sm text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline disabled:opacity-50";

export function FormularioLogin() {
  const [estado, accion, pendiente] = useActionState(accionLogin, inicial);

  if (estado.paso === "correo") {
    return (
      <form action={accion} className="space-y-4">
        <input type="hidden" name="intencion" value="enviar" />
        <div className="space-y-1">
          <label htmlFor="correo" className="text-sm font-medium">
            Correo
          </label>
          <input
            id="correo"
            name="correo"
            type="email"
            required
            autoFocus
            autoComplete="email"
            defaultValue={estado.correo}
            className={campo}
          />
        </div>
        {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
        <button type="submit" disabled={pendiente} className={botonPrincipal}>
          {pendiente ? "Enviando…" : "Enviar código"}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <form action={accion} className="space-y-4">
        <input type="hidden" name="intencion" value="verificar" />
        <input type="hidden" name="correo" value={estado.correo} />
        {estado.aviso && <Mensaje tipo="aviso">{estado.aviso}</Mensaje>}
        <div className="space-y-1">
          <label htmlFor="codigo" className="text-sm font-medium">
            Código
          </label>
          <input
            id="codigo"
            name="codigo"
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            className={`${campo} font-mono tracking-[0.5em]`}
          />
        </div>
        {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
        <button type="submit" disabled={pendiente} className={botonPrincipal}>
          {pendiente ? "Verificando…" : "Entrar"}
        </button>
      </form>
      <form action={accion} className="flex justify-between">
        <input type="hidden" name="correo" value={estado.correo} />
        <button
          type="submit"
          name="intencion"
          value="enviar"
          disabled={pendiente}
          className={botonEnlace}
        >
          Reenviar código
        </button>
        <button
          type="submit"
          name="intencion"
          value="cambiar"
          disabled={pendiente}
          className={botonEnlace}
        >
          Usar otro correo
        </button>
      </form>
    </div>
  );
}

function Mensaje({
  tipo,
  children,
}: {
  tipo: "error" | "aviso";
  children: React.ReactNode;
}) {
  const estilo =
    tipo === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-neutral-200 bg-neutral-50 text-neutral-700";
  return (
    <p role={tipo === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${estilo}`}>
      {children}
    </p>
  );
}
