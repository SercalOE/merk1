// KPIs del mes como en la hoja Insights: una fila por KPI, columnas por año real y la meta,
// más el crecimiento entre los dos últimos años reales y el de la meta contra el último real.

export type KpiEntrada = { kpi: string; anio: number; valor: number | null; tipo: "real" | "meta" };

export type FilaKpi = {
  kpi: string;
  reales: Record<number, number | null>;
  meta: number | null;
  crecimiento_real: number | null; // último año real vs el anterior
  crecimiento_meta: number | null; // meta vs último año real
};

export type TablaKpis = {
  anios: number[]; // años reales, de menor a mayor
  anio_meta: number | null;
  filas: FilaKpi[];
};

// Orden fijo de la hoja Insights. Un KPI que no esté aquí va al final, por nombre.
export const ORDEN_KPIS = ["Alcance", "MQLs", "Interacción", "Usuarios web"];

function compararKpis(a: string, b: string): number {
  const posicion = (k: string) => {
    const i = ORDEN_KPIS.indexOf(k);
    return i === -1 ? ORDEN_KPIS.length : i;
  };
  return posicion(a) - posicion(b) || a.localeCompare(b, "es");
}

export function tablaKpis(kpis: KpiEntrada[]): TablaKpis {
  const anios = [...new Set(kpis.filter((k) => k.tipo === "real").map((k) => k.anio))].sort((a, b) => a - b);
  const aniosMeta = kpis.filter((k) => k.tipo === "meta").map((k) => k.anio);
  const anioMeta = aniosMeta.length > 0 ? Math.max(...aniosMeta) : null;
  const [penultimo, ultimo] = anios.slice(-2);

  const nombres = [...new Set(kpis.map((k) => k.kpi))].sort(compararKpis);
  const filas = nombres.map((kpi): FilaKpi => {
    const valor = (tipo: "real" | "meta", anio: number | null | undefined) =>
      anio == null ? null : (kpis.find((k) => k.kpi === kpi && k.tipo === tipo && k.anio === anio)?.valor ?? null);

    const reales = Object.fromEntries(anios.map((a) => [a, valor("real", a)]));
    const meta = valor("meta", anioMeta);
    const ult = valor("real", ultimo);
    return {
      kpi,
      reales,
      meta,
      crecimiento_real: anios.length >= 2 ? crecimiento(ult, valor("real", penultimo)) : null,
      crecimiento_meta: crecimiento(meta, ult),
    };
  });

  return { anios, anio_meta: anioMeta, filas };
}

// nuevo ÷ base − 1; sin dato o base 0 no hay crecimiento.
function crecimiento(nuevo: number | null, base: number | null): number | null {
  if (nuevo == null || base == null || base === 0) return null;
  return nuevo / base - 1;
}
