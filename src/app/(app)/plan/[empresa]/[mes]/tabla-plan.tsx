"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CeldaMonto } from "@/components/monto";
import { numero, q, rangoFechas, TIPO_COSTO, usd } from "@/lib/formato";
import type { LineaPlan } from "@/lib/plan/datos";
import { BotonCopiar } from "./copiar";

const FILTROS = ["actividad", "medio"] as const;
type Filtro = (typeof FILTROS)[number];

// Tabla de líneas con filtros por actividad y medio guardados en la URL (?actividad=…&medio=…).
export function TablaPlan({ lineas, tc }: { lineas: LineaPlan[]; tc: number }) {
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();
  const elegido = (f: Filtro) => parametros.get(f) ?? "";

  const opciones = (f: Filtro) => [...new Set(lineas.map((l) => l[f]))];
  const visibles = lineas.filter((l) => FILTROS.every((f) => !elegido(f) || l[f] === elegido(f)));
  const totalQ = visibles.reduce((suma, l) => suma + l.inversion_q, 0);
  const hayFiltro = FILTROS.some((f) => elegido(f));

  function filtrar(f: Filtro, valor: string) {
    const nuevos = new URLSearchParams(parametros.toString());
    if (valor) nuevos.set(f, valor);
    else nuevos.delete(f);
    const consulta = nuevos.toString();
    router.replace(consulta ? `${ruta}?${consulta}` : ruta, { scroll: false });
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-end gap-4 border-b border-neutral-200 px-4 py-3">
        {FILTROS.map((f) => (
          <label key={f} className="text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
              {f === "actividad" ? "Actividad" : "Medio"}
            </span>
            <select
              value={elegido(f)}
              onChange={(e) => filtrar(f, e.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">{f === "actividad" ? "Todas" : "Todos"}</option>
              {opciones(f).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        ))}
        {hayFiltro && (
          <button
            type="button"
            onClick={() => router.replace(ruta, { scroll: false })}
            className="pb-1.5 text-sm text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline"
          >
            Quitar filtros
          </button>
        )}
        <div className="ml-auto flex items-center gap-3 pb-0.5">
          <span className="text-sm text-neutral-600">
            {visibles.length} de {lineas.length} líneas
          </span>
          <BotonCopiar
            texto={visibles.map((l) => l.nombre_campana).join("\n")}
            etiqueta="Copiar todos los nombres"
            titulo={`Copia los ${visibles.length} nombres de campaña, uno por renglón`}
            className="px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-neutral-600">No hay líneas con esos filtros.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Código</th>
                <th className="px-4 py-2 font-medium">Actividad</th>
                <th className="px-4 py-2 font-medium">Fechas</th>
                <th className="px-4 py-2 font-medium">Medio</th>
                <th className="px-4 py-2 font-medium">Objetivo</th>
                <th className="px-4 py-2 font-medium">Partida</th>
                <th className="px-4 py-2 text-right font-medium">Inversión</th>
                <th className="px-4 py-2 text-right font-medium">Costo est.</th>
                <th className="px-4 py-2 font-medium">Tipo de costo</th>
                <th className="px-4 py-2 text-right font-medium">Resultado proyectado</th>
                <th className="px-4 py-2 font-medium">Nombre de campaña</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {visibles.map((l) => (
                <tr key={l.codigo} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">
                    {l.codigo}
                    {l.plan !== "principal" && (
                      <span
                        title={l.nombre_plan_extra ?? undefined}
                        className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 font-sans text-[11px] text-amber-900"
                      >
                        {l.plan === "extra" ? (l.nombre_plan_extra ?? "Extra") : "Arrastre"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{l.actividad}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {rangoFechas(l.fecha_inicio, l.fecha_fin)}
                    {l.fechas_envio && <div className="text-xs text-neutral-500">Envío: {l.fechas_envio}</div>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">{l.medio}</td>
                  <td className="px-4 py-2">{l.objetivo}</td>
                  <td className="px-4 py-2">{l.partida}</td>
                  <CeldaMonto monto={l.inversion_q} tc={tc} />
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                    {l.tipo_costo === "sin_costo" ? "—" : q(l.costo_estimado)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">{TIPO_COSTO[l.tipo_costo]}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    <div>{numero(l.proyectado)}</div>
                    <div className="text-xs text-neutral-500">{l.resultado}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-start gap-2">
                      <span className="min-w-56 font-mono text-xs leading-5">{l.nombre_campana}</span>
                      <BotonCopiar texto={l.nombre_campana} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-neutral-200 font-semibold">
              <tr>
                <td className="px-4 py-2" colSpan={6}>
                  Total{hayFiltro ? " filtrado" : ""}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  <div>{q(totalQ)}</div>
                  <div className="text-xs font-normal text-neutral-500">{usd(totalQ / tc)}</div>
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
