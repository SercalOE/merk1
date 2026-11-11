import { inversionQ } from "../calculos";
import type { Problema, Validacion } from "./tipos";

export type PartidaResumen = {
  partida: string;
  disponible_q: number; // saldo anterior + presupuesto del mes
  planeado_q: number;
  diferencia_q: number; // disponible − planeado (negativo = se pasa)
};

// Qué le pasa a plan_lineas al aplicar la carga (upsert por codigo + mes).
export type CambiosLineas = {
  mes_existe: boolean;
  crear: string[];
  actualizar: string[];
  eliminar: string[];
};

export type ResumenMes = {
  empresa_codigo: string;
  mes: string;
  tipo_cambio: number;
  lineas: number;
  plan_q: number;
  plan_usd: number;
  partidas: PartidaResumen[];
  cambios: CambiosLineas | null; // null si no se consultó la base
};

export type Resumen = {
  meses: ResumenMes[];
  total_lineas: number;
  errores: Problema[];
  avisos: Problema[];
};

// Códigos que ya hay en plan_lineas, por "EMP|AAAA-MM". Un mes sin clave es un mes nuevo.
export type LineasExistentes = Map<string, string[]>;

export function resumir(validacion: Validacion, existentes?: LineasExistentes): Resumen {
  const meses = validacion.meses.map((m): ResumenMes => {
    const planeado = new Map<string, number>();
    for (const l of m.lineas) planeado.set(l.partida, (planeado.get(l.partida) ?? 0) + l.inversion_q);

    // Primero las partidas en el orden de la hoja Presupuesto, luego las que solo aparecen en el Plan.
    const nombres = [...new Set([...m.presupuestos.map((p) => p.partida), ...planeado.keys()])];
    const partidas = nombres.map((partida): PartidaResumen => {
      const p = m.presupuestos.find((x) => x.partida === partida);
      const disponible = p ? inversionQ(p.saldo_anterior + p.presupuesto_mes, p.moneda, m.tipo_cambio) : 0;
      const plan = planeado.get(partida) ?? 0;
      return { partida, disponible_q: disponible, planeado_q: plan, diferencia_q: disponible - plan };
    });

    const planQ = m.lineas.reduce((suma, l) => suma + l.inversion_q, 0);
    return {
      empresa_codigo: m.empresa_codigo,
      mes: m.mes,
      tipo_cambio: m.tipo_cambio,
      lineas: m.lineas.length,
      plan_q: planQ,
      plan_usd: planQ / m.tipo_cambio,
      partidas,
      cambios: existentes
        ? compararLineas(
            m.lineas.map((l) => l.codigo),
            existentes.get(`${m.empresa_codigo}|${m.mes}`),
          )
        : null,
    };
  });

  return {
    meses,
    total_lineas: meses.reduce((suma, m) => suma + m.lineas, 0),
    errores: validacion.problemas.filter((p) => p.nivel === "error"),
    avisos: validacion.problemas.filter((p) => p.nivel === "aviso"),
  };
}

export function compararLineas(nuevos: string[], actuales: string[] | undefined): CambiosLineas {
  const antes = new Set(actuales ?? []);
  const despues = new Set(nuevos);
  return {
    mes_existe: actuales !== undefined,
    crear: nuevos.filter((c) => !antes.has(c)),
    actualizar: nuevos.filter((c) => antes.has(c)),
    eliminar: [...antes].filter((c) => !despues.has(c)),
  };
}
