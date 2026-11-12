"use client";

import { useActionState } from "react";
import { mesLargo, q, usd } from "@/lib/formato";
import type { Problema, ResumenMes } from "@/lib/plantilla";
import { accionCarga, type EstadoCarga, type ResultadoMes } from "./actions";

const inicial: EstadoCarga = { paso: "subir" };

const botonPrincipal =
  "rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40";
const botonSecundario =
  "rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40";

export function FormularioCarga() {
  const [estado, accion, pendiente] = useActionState(accionCarga, inicial);

  if (estado.paso === "subir") {
    return (
      <form action={accion} className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <input type="hidden" name="intencion" value="validar" />
        <label htmlFor="archivo" className="block text-sm font-medium">
          Archivo de la plantilla
        </label>
        <input
          id="archivo"
          name="archivo"
          type="file"
          required
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-neutral-100 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-neutral-200"
        />
        {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
        <button type="submit" disabled={pendiente} className={botonPrincipal}>
          {pendiente ? "Validando…" : "Validar"}
        </button>
      </form>
    );
  }

  if (estado.paso === "aplicada") {
    return (
      <div className="space-y-4">
        <Mensaje tipo="ok">Plan guardado desde {estado.archivo}.</Mensaje>
        <ul className="space-y-2">
          {estado.meses.map((m) => (
            <ResultadoAplicado key={`${m.empresa_codigo}|${m.mes}`} mes={m} empresa={estado.empresas[m.empresa_codigo]} />
          ))}
        </ul>
        <form action={accion}>
          <input type="hidden" name="intencion" value="reiniciar" />
          <button type="submit" className={botonSecundario}>
            Subir otro archivo
          </button>
        </form>
      </div>
    );
  }

  const { resumen } = estado;
  const hayErrores = resumen.errores.length > 0;
  const reemplaza = resumen.meses.filter((m) => m.cambios?.mes_existe);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-neutral-600">
          Archivo: <span className="font-medium text-neutral-900">{estado.archivo}</span>
        </p>
        <p className="text-sm text-neutral-600">
          {resumen.meses.length} {resumen.meses.length === 1 ? "mes" : "meses"} · {resumen.total_lineas} líneas ·{" "}
          <span className={hayErrores ? "font-medium text-red-700" : ""}>{resumen.errores.length} errores</span> ·{" "}
          {resumen.avisos.length} avisos
        </p>
      </div>

      {hayErrores && (
        <ListaProblemas
          titulo="Errores (bloquean la carga)"
          problemas={resumen.errores}
          estilo="border-red-200 bg-red-50 text-red-900"
        />
      )}

      {resumen.meses.map((m) => (
        <TarjetaMes key={`${m.empresa_codigo}|${m.mes}`} mes={m} empresa={estado.empresas[m.empresa_codigo]} />
      ))}

      {resumen.avisos.length > 0 && (
        <ListaProblemas
          titulo="Avisos (no bloquean)"
          problemas={resumen.avisos}
          estilo="border-amber-200 bg-amber-50 text-amber-900"
        />
      )}

      <form action={accion} className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <input type="hidden" name="carga_id" value={estado.cargaId} />
        <input type="hidden" name="firma" value={estado.firma} />
        {reemplaza.length > 0 && !hayErrores && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="reemplazar" value="si" required className="mt-0.5" />
            <span>
              Entiendo que esta carga reemplaza el plan de{" "}
              {reemplaza.map((m) => `${m.empresa_codigo} ${mesLargo(m.mes)}`).join(", ")}
              {reemplaza.some((m) => (m.cambios?.eliminar.length ?? 0) > 0) && ", incluida la eliminación de líneas"}.
            </span>
          </label>
        )}
        {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
        {hayErrores && (
          <p className="text-sm text-neutral-600">Corrige los errores en el Excel y súbelo de nuevo para poder guardar.</p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" name="intencion" value="confirmar" disabled={pendiente || hayErrores} className={botonPrincipal}>
            {pendiente ? "Guardando…" : "Confirmar y guardar"}
          </button>
          <button type="submit" name="intencion" value="reiniciar" formNoValidate disabled={pendiente} className={botonSecundario}>
            Subir otro archivo
          </button>
        </div>
      </form>
    </div>
  );
}

function TarjetaMes({ mes, empresa }: { mes: ResumenMes; empresa?: string }) {
  const tc = mes.tipo_cambio;
  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-200 px-5 py-4">
        <h2 className="text-lg font-semibold">
          {empresa ?? mes.empresa_codigo} · {mesLargo(mes.mes)}
        </h2>
        <p className="text-sm text-neutral-600">
          {mes.lineas} líneas · Plan <span className="font-medium text-neutral-900">{q(mes.plan_q)}</span> ({usd(mes.plan_usd)}) · TC{" "}
          {tc}
        </p>
      </header>

      {mes.cambios && <Cambios cambios={mes.cambios} />}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-5 py-2 font-medium">Partida</th>
              <th className="px-5 py-2 text-right font-medium">Disponible</th>
              <th className="px-5 py-2 text-right font-medium">Planeado</th>
              <th className="px-5 py-2 text-right font-medium">Diferencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {mes.partidas.map((p) => (
              <tr key={p.partida}>
                <td className="px-5 py-2">{p.partida}</td>
                <Monto monto={p.disponible_q} tc={tc} />
                <Monto monto={p.planeado_q} tc={tc} />
                <Monto monto={p.diferencia_q} tc={tc} alerta={p.diferencia_q < -0.005} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Cambios({ cambios }: { cambios: NonNullable<ResumenMes["cambios"]> }) {
  if (!cambios.mes_existe) {
    return (
      <p className="border-b border-neutral-200 px-5 py-3 text-sm text-neutral-700">
        Mes nuevo: se crean {cambios.crear.length} líneas.
      </p>
    );
  }
  return (
    <div className="space-y-1 border-b border-neutral-200 bg-amber-50/50 px-5 py-3 text-sm text-neutral-700">
      <p>
        <span className="font-medium text-neutral-900">El mes ya existe.</span> Se crean {cambios.crear.length}, se
        actualizan {cambios.actualizar.length} y se eliminan{" "}
        <span className={cambios.eliminar.length > 0 ? "font-medium text-red-700" : ""}>{cambios.eliminar.length}</span>{" "}
        líneas.
      </p>
      {cambios.crear.length > 0 && <p className="font-mono text-xs">Nuevas: {cambios.crear.join(", ")}</p>}
      {cambios.eliminar.length > 0 && (
        <p className="font-mono text-xs text-red-700">Se eliminan: {cambios.eliminar.join(", ")}</p>
      )}
    </div>
  );
}

function Monto({ monto, tc, alerta = false }: { monto: number; tc: number; alerta?: boolean }) {
  return (
    <td className={`px-5 py-2 text-right tabular-nums ${alerta ? "text-red-700" : ""}`}>
      <div>{q(monto)}</div>
      <div className="text-xs text-neutral-500">{usd(monto / tc)}</div>
    </td>
  );
}

function ListaProblemas({ titulo, problemas, estilo }: { titulo: string; problemas: Problema[]; estilo: string }) {
  return (
    <section className={`rounded-lg border px-5 py-4 ${estilo}`}>
      <h2 className="mb-2 text-sm font-semibold">
        {titulo} · {problemas.length}
      </h2>
      <ul className="space-y-1 text-sm">
        {problemas.map((p, i) => (
          <li key={i}>
            <span className="font-mono text-xs opacity-75">
              {p.hoja}
              {p.fila ? ` · fila ${p.fila}` : ""}
              {p.columna ? ` · ${p.columna}` : ""}
            </span>{" "}
            {p.mensaje}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResultadoAplicado({ mes, empresa }: { mes: ResultadoMes; empresa?: string }) {
  return (
    <li className="rounded-lg border border-neutral-200 bg-white px-5 py-3 text-sm">
      <span className="font-medium">
        {empresa ?? mes.empresa_codigo} · {mesLargo(mes.mes)}
      </span>
      : {mes.creadas} líneas creadas, {mes.actualizadas} actualizadas, {mes.eliminadas} eliminadas.
    </li>
  );
}

function Mensaje({ tipo, children }: { tipo: "error" | "ok"; children: React.ReactNode }) {
  const estilo = tipo === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800";
  return (
    <p role={tipo === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${estilo}`}>
      {children}
    </p>
  );
}
