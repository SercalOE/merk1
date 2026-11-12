import { inversionQ } from "../calculos";
import type { Moneda } from "../plantilla/tipos";

// Resúmenes del plan de un mes. Los usan /cargar (antes de guardar) y /plan (lo guardado).

export type PresupuestoEntrada = {
  partida: string;
  saldo_anterior: number;
  presupuesto_mes: number;
  moneda: Moneda;
};

export type LineaEntrada = {
  actividad: string;
  partida: string;
  inversion_q: number;
};

export type PartidaResumen = {
  partida: string;
  disponible_q: number; // saldo anterior + presupuesto del mes
  planeado_q: number;
  diferencia_q: number; // disponible − planeado (negativo = se pasa)
};

export type ActividadResumen = {
  actividad: string;
  inversion_q: number;
  porcentaje: number; // del total del plan, de 0 a 1
};

// Disponible contra planeado por partida. Primero las partidas en el orden del presupuesto,
// luego las que solo aparecen en el plan (disponible 0).
export function porPartida(
  presupuestos: PresupuestoEntrada[],
  lineas: LineaEntrada[],
  tipoCambio: number,
): PartidaResumen[] {
  const planeado = sumarPor(lineas, (l) => l.partida);
  const nombres = [...new Set([...presupuestos.map((p) => p.partida), ...planeado.keys()])];
  return nombres.map((partida) => {
    const p = presupuestos.find((x) => x.partida === partida);
    const disponible = p ? inversionQ(p.saldo_anterior + p.presupuesto_mes, p.moneda, tipoCambio) : 0;
    const plan = planeado.get(partida) ?? 0;
    return { partida, disponible_q: disponible, planeado_q: plan, diferencia_q: disponible - plan };
  });
}

// Inversión por actividad, en el orden en que aparece cada actividad en el plan.
export function porActividad(lineas: LineaEntrada[]): ActividadResumen[] {
  const total = lineas.reduce((suma, l) => suma + l.inversion_q, 0);
  return [...sumarPor(lineas, (l) => l.actividad)].map(([actividad, inversion]) => ({
    actividad,
    inversion_q: inversion,
    porcentaje: total === 0 ? 0 : inversion / total,
  }));
}

function sumarPor(lineas: LineaEntrada[], clave: (l: LineaEntrada) => string): Map<string, number> {
  const sumas = new Map<string, number>();
  for (const l of lineas) sumas.set(clave(l), (sumas.get(clave(l)) ?? 0) + l.inversion_q);
  return sumas;
}
