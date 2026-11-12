import { porPartida, type PartidaResumen } from "../plan/resumen";
import type { Problema, Validacion } from "./tipos";

export type { PartidaResumen };

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
    const partidas = porPartida(m.presupuestos, m.lineas, m.tipo_cambio);
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
